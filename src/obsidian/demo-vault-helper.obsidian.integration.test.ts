/// <reference types="obsidian-integration-testing/vitest/typings" />

import { pollInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

const HELPER_PLUGIN_ID = 'demo-vault-helper';
const CST_PLUGIN_ID = 'fix-require-modules';
const START_NOTE_PATH = '00 Start.md';
const MODULES_ROOT = '_assets/CodeScriptToolkit';

const TEST_TIMEOUT_IN_MILLISECONDS = 150000;
const POLL_INTERVAL_IN_MILLISECONDS = 2000;
const POLL_TIMEOUT_IN_MILLISECONDS = 120000;

// The bootstrap progress snapshot the poll closure returns each attempt: `startupRan` + `cstEnabled` are the
// Acceptance signal; the rest are asserted on success and reported on a flake (the CST store install is
// Network-dependent, so a timeout shows how far the bootstrap got instead of a bare `false`).
interface BootstrapStatus {
  readonly activeFilePath: null | string;
  readonly cstEnabled: boolean;
  readonly cstInstalled: boolean;
  readonly dataJson: null | string;
  readonly helperEnabled: boolean;
  readonly helperInstalled: boolean;
  readonly noticeText: string;
  readonly probeValue: unknown;
  readonly startupRan: boolean;
}

describe('demo-vault-helper bootstrap', () => {
  // This test is meant to run in a DEDICATED integration project with its own isolated vault: a `createSetup`
  // Global setup is staged at `scripts/demo-vault-helper-global-setup.ts` (seeds the vault with the committed
  // Helper + the probe/startup scripts + start note, and enables the helper via the harness's
  // `enableCommunityPlugins` path, which kicks off the helper's on-layout-ready bootstrap that installs
  // CodeScript Toolkit from the store). That project is NOT wired into `scripts/vitest-config.ts` yet — see
  // Below — so this file currently only compiles (it is `it.skip`-ped and its home project boots nothing).
  //
  // SKIPPED pending a CodeScript Toolkit release. Setup + install + configure + enable all pass, but the
  // `startupRan`/`probeValue`/`activeFilePath` assertions require CST to run its startup script when enabled
  // AFTER layout-ready. That was a load-vs-execute race in `LayoutReadyComponent` (fixed in this repo), but CST
  // Bundles its OWN copy of obsidian-dev-utils, so the fix only reaches CST once it re-releases with a bumped
  // Dev-utils. To re-enable (see T126 / T130): after CST releases, wire the dedicated
  // `obsidian-integration-tests:demo-vault-helper` project (its global setup is staged) into
  // `scripts/vitest-config.ts`, add it to `scripts/test-integration.ts`, and drop this `.skip`.
  it.skip('should install, configure, enable CodeScript Toolkit and run startup with no reload', async () => {
    const vaultPath = getTempVault().path;

    let lastStatus: BootstrapStatus | undefined;
    let status: BootstrapStatus;

    // Poll from the Node side (each eval is quick): the real store install can outlast CDP's single-command
    // Timeout, so the wait cannot live inside one closure.
    try {
      status = await pollInObsidian({
        args: { cstPluginId: CST_PLUGIN_ID, helperPluginId: HELPER_PLUGIN_ID },
        intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
        async poll({ app, cstPluginId, helperPluginId }): Promise<BootstrapStatus> {
          const cstInstalled = Boolean(app.plugins.manifests[cstPluginId]);
          let noticeText = '';
          for (const noticeEl of Array.from(document.querySelectorAll('.notice'))) {
            if (noticeEl.textContent.includes('Demo Vault Helper')) {
              noticeText = noticeEl.textContent;
            }
          }
          return {
            activeFilePath: app.workspace.getActiveFile()?.path ?? null,
            cstEnabled: app.plugins.enabledPlugins.has(cstPluginId),
            cstInstalled,
            dataJson: cstInstalled ? await app.vault.adapter.read(`${app.vault.configDir}/plugins/${cstPluginId}/data.json`) : null,
            helperEnabled: app.plugins.enabledPlugins.has(helperPluginId),
            helperInstalled: Boolean(app.plugins.manifests[helperPluginId]),
            noticeText,
            probeValue: Reflect.get(window, '__demoVaultHelperProbeValue') ?? null,
            startupRan: Reflect.get(window, '__demoVaultHelperStartupRan') === true
          };
        },
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        until(pollResult: BootstrapStatus): boolean {
          lastStatus = pollResult;
          return pollResult.startupRan && pollResult.cstEnabled;
        },
        vaultPath
      });
    } catch (error) {
      throw new Error(`demo-vault-helper bootstrap did not complete; last status: ${String(JSON.stringify(lastStatus))}`, { cause: error });
    }

    expect(status.cstInstalled).toBe(true);
    expect(status.cstEnabled).toBe(true);
    expect(status.dataJson).toContain(MODULES_ROOT);
    expect(status.dataJson).toContain('startupScriptPath');
    expect(status.activeFilePath).toBe(START_NOTE_PATH);
    expect(status.probeValue).toBe('ok');
  }, TEST_TIMEOUT_IN_MILLISECONDS);
});
