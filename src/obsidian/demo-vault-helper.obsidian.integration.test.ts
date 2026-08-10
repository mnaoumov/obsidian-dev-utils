/// <reference types="obsidian-integration-testing/vitest/typings" />

import {
  evalInObsidian,
  pollInObsidian
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

const HELPER_PLUGIN_ID = 'demo-vault-helper';
const CST_PLUGIN_ID = 'fix-require-modules';
const START_NOTE_PATH = '00 Start.md';
const MODULES_ROOT = '_assets/CodeScriptToolkit';

const TEST_TIMEOUT_IN_MILLISECONDS = 150_000;
const POLL_INTERVAL_IN_MILLISECONDS = 2000;
const POLL_TIMEOUT_IN_MILLISECONDS = 120_000;
// The dismissal is local UI work — no network, no plugin install — so it needs a much tighter poll than
// The bootstrap above; a slow answer here means the notice is NOT dismissing, which is the defect.
const DISMISS_POLL_INTERVAL_IN_MILLISECONDS = 250;
const DISMISS_POLL_TIMEOUT_IN_MILLISECONDS = 15_000;

// The sandbox notice is the only notice that must OUTLIVE the bootstrap, so it is matched on its own
// Wording. The vault it describes ships only the helper, so the notice names no plugin.
const SANDBOX_NOTICE_MARKER = 'temporary sandbox';

// The bootstrap progress snapshot the poll closure returns each attempt: `startupRan` + `cstEnabled` +
// `sandboxNoticeText` are the acceptance signal; the rest are asserted on success and reported on a flake
// (the CST store install is network-dependent, so a timeout shows how far the bootstrap got instead of a
// Bare `false`).
interface BootstrapStatus {
  readonly activeFilePath: null | string;
  readonly cstEnabled: boolean;
  readonly cstInstalled: boolean;
  readonly dataJson: null | string;
  readonly helperEnabled: boolean;
  readonly helperInstalled: boolean;
  readonly noticeText: string;
  readonly probeValue: unknown;
  readonly sandboxNoticeText: string;
  readonly startupRan: boolean;
}

// Whether the sandbox notice has left the DOM. Polled rather than read once, because Obsidian fades a
// Dismissed notice out before removing its element.
interface SandboxNoticeDismissal {
  readonly isGone: boolean;
}

describe('demo-vault-helper bootstrap', () => {
  // This test runs in the DEDICATED `obsidian-integration-tests:demo-vault-helper` project (see
  // `scripts/vitest-config.ts`), which boots its own isolated Obsidian instance/vault via
  // `scripts/demo-vault-helper-global-setup.ts`. That global setup seeds the vault with the committed helper
  // Plus the probe/startup scripts + start note, and enables the helper via the harness's
  // `enableCommunityPlugins` path, which kicks off the helper's on-layout-ready bootstrap that installs
  // CodeScript Toolkit from the store.
  //
  // NOTE: CST is installed FROM THE STORE and bundles its own copy of obsidian-dev-utils, so the
  // `startupRan`/`probeValue`/`activeFilePath` assertions (CST running its startup script when enabled AFTER
  // Layout-ready — the `LayoutReadyComponent` load-vs-execute race fixed in this repo) only pass once the
  // Store serves a CST release built against the fixed dev-utils (CST 13.4.1+; see T126 / T130).
  it('should install, configure, enable CodeScript Toolkit and run startup with no reload', async () => {
    const vaultPath = getTemporaryVault().path;

    let lastStatus: BootstrapStatus | undefined;
    let status: BootstrapStatus;

    // Poll from the Node side (each eval is quick): the real store install can outlast CDP's single-command
    // Timeout, so the wait cannot live inside one closure.
    try {
      status = await pollInObsidian({
        input: { cstPluginId: CST_PLUGIN_ID, helperPluginId: HELPER_PLUGIN_ID, sandboxNoticeMarker: SANDBOX_NOTICE_MARKER },
        intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
        async poll({ app, cstPluginId, helperPluginId, sandboxNoticeMarker }): Promise<BootstrapStatus> {
          const isCstInstalled = Object.hasOwn(app.plugins.manifests, cstPluginId);
          let noticeText = '';
          let sandboxNoticeText = '';
          for (const noticeEl of document.querySelectorAll('.notice')) {
            if (noticeEl.textContent.includes('Demo Vault Helper')) {
              noticeText = noticeEl.textContent;
            }
            if (noticeEl.textContent.includes(sandboxNoticeMarker)) {
              sandboxNoticeText = noticeEl.textContent;
            }
          }
          return {
            activeFilePath: app.workspace.getActiveFile()?.path ?? null,
            cstEnabled: app.plugins.enabledPlugins.has(cstPluginId),
            cstInstalled: isCstInstalled,
            dataJson: isCstInstalled ? await app.vault.adapter.read(`${app.vault.configDir}/plugins/${cstPluginId}/data.json`) : null,
            helperEnabled: app.plugins.enabledPlugins.has(helperPluginId),
            helperInstalled: Object.hasOwn(app.plugins.manifests, helperPluginId),
            noticeText,
            probeValue: Reflect.get(window, '__demoVaultHelperProbeValue') ?? null,
            sandboxNoticeText,
            startupRan: Reflect.get(window, '__demoVaultHelperStartupRan') === true
          };
        },
        timeoutInMilliseconds: POLL_TIMEOUT_IN_MILLISECONDS,
        until(pollResult: BootstrapStatus): boolean {
          lastStatus = pollResult;
          // The sandbox notice is required in the SAME sample as `startupRan`: that is what proves it
          // Survived CodeScript Toolkit's startup script opening the start note, rather than being
          // Replaced or dismissed by it.
          return pollResult.startupRan && pollResult.cstEnabled && pollResult.sandboxNoticeText !== '';
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
    // The vault ships only the helper, so the notice names no plugin — but it must still say what the
    // Vault is, that it is temporary, and how long it lasts.
    expect(status.sandboxNoticeText).toContain('This is a demo vault.');
    expect(status.sandboxNoticeText).toContain('cleaned up automatically about a day after you last use it');
    // Not compared against `vaultPath` itself: that is a Node-side path string, while the notice carries
    // Whatever the adapter reports, which differs in separators per platform.
    expect(status.sandboxNoticeText).toContain(`${SANDBOX_NOTICE_MARKER} at `);
  }, TEST_TIMEOUT_IN_MILLISECONDS);

  // The requested duration (`0`) only says "do not expire on a timer"; it does not prove the notice can
  // Still be got rid of. The accepted behavior is Obsidian's own sandbox-vault notice — it stays until
  // The user clicks it — so the click is what has to be exercised, in a real Obsidian, against a real
  // `Notice`. A unit test cannot: it sees the constructor arguments, not Obsidian's dismiss handler.
  //
  // Runs after the bootstrap test in the same instance (the project is serial, single-worker), so the
  // Notice this dismisses is the one raised there. It waits for the notice itself rather than assuming
  // The previous test left it up.
  it('should dismiss the sandbox notice when the user clicks it', async () => {
    const vaultPath = getTemporaryVault().path;

    const wasPresentBeforeClick = await evalInObsidian({
      callback({ sandboxNoticeMarker }): boolean {
        for (const noticeEl of document.querySelectorAll<HTMLElement>('.notice')) {
          if (noticeEl.textContent.includes(sandboxNoticeMarker)) {
            noticeEl.click();
            return true;
          }
        }
        return false;
      },
      input: { sandboxNoticeMarker: SANDBOX_NOTICE_MARKER },
      vaultPath
    });
    expect(wasPresentBeforeClick).toBe(true);

    // Obsidian fades a dismissed notice out before removing its element, so the disappearance is polled
    // Rather than read once.
    let lastDismissal: SandboxNoticeDismissal | undefined;
    try {
      await pollInObsidian({
        input: { sandboxNoticeMarker: SANDBOX_NOTICE_MARKER },
        intervalInMilliseconds: DISMISS_POLL_INTERVAL_IN_MILLISECONDS,
        poll({ sandboxNoticeMarker }): SandboxNoticeDismissal {
          for (const noticeEl of document.querySelectorAll('.notice')) {
            if (noticeEl.textContent.includes(sandboxNoticeMarker)) {
              return { isGone: false };
            }
          }
          return { isGone: true };
        },
        timeoutInMilliseconds: DISMISS_POLL_TIMEOUT_IN_MILLISECONDS,
        until(pollResult: SandboxNoticeDismissal): boolean {
          lastDismissal = pollResult;
          return pollResult.isGone;
        },
        vaultPath
      });
    } catch (error) {
      throw new Error(`the sandbox notice was still shown after being clicked; last state: ${String(JSON.stringify(lastDismissal))}`, { cause: error });
    }
  }, TEST_TIMEOUT_IN_MILLISECONDS);
});
