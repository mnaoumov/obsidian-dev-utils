/// <reference types="obsidian-integration-testing/vitest/typings" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import { sleep } from '../async.ts';
import { EMPTY } from '../string.ts';

const HELPER_PLUGIN_ID = 'demo-vault-helper';
const CST_PLUGIN_ID = 'fix-require-modules';
const START_NOTE_PATH = '00 Start.md';
const MODULES_ROOT = '_assets/CodeScriptToolkit';
// CodeScript Toolkit resolves a single leading `/` against `modulesRoot`, so `/probe.ts` is `<modulesRoot>/probe.ts`.
const PROBE_MODULE_PATH = '/probe.ts';

const TEST_TIMEOUT_IN_MILLISECONDS = 150000;
const POLL_INTERVAL_IN_MILLISECONDS = 2000;
const MAX_POLL_ATTEMPTS = 50;

const DIST_HELPER_DIR = join(import.meta.dirname, '../../dist/demo-vault-helper');

// The CodeScript Toolkit startup script (run once CST loads via `startupScriptPath`): opens the start note and resolves a module under `modulesRoot` via CST's `require`, proving the plugin loaded already configured with no reload. Runs inside CST, so it uses plain runtime `require` (not linted here).
const STARTUP_SCRIPT = `
export async function invoke(app) {
  const startNote = app.vault.getFileByPath('${START_NOTE_PATH}');
  if (startNote) {
    await app.workspace.getLeaf(false).openFile(startNote);
  }
  try {
    const probe = require('${PROBE_MODULE_PATH}');
    window.__demoVaultHelperProbeValue = probe.PROBE;
  } catch (error) {
    window.__demoVaultHelperProbeValue = 'require-failed: ' + String(error);
  }
  window.__demoVaultHelperStartupRan = true;
}
`;

const PROBE_MODULE = 'export const PROBE = \'ok\';\n';

describe('demo-vault-helper bootstrap', () => {
  beforeAll(() => {
    // Seed the shared (already-open) vault with the committed helper plugin, a CodeScript Toolkit startup script, a probe module, and a start note. No CodeScript Toolkit config is committed — the helper writes it at runtime.
    getTempVault().populate({
      [`${EMPTY}.obsidian/plugins/${HELPER_PLUGIN_ID}/main.js`]: readFileSync(join(DIST_HELPER_DIR, 'main.js'), 'utf-8'),
      [`${EMPTY}.obsidian/plugins/${HELPER_PLUGIN_ID}/manifest.json`]: readFileSync(join(DIST_HELPER_DIR, 'manifest.json'), 'utf-8'),
      [`${MODULES_ROOT}/probe.ts`]: PROBE_MODULE,
      [`${MODULES_ROOT}/startup.ts`]: STARTUP_SCRIPT,
      [START_NOTE_PATH]: '# Start\n'
    });
  });

  it('should install, configure, enable CodeScript Toolkit and run startup with no reload', async () => {
    const vaultPath = getTempVault().path;

    // The helper was written after boot, so re-scan manifests, then force-load it (the owned CDP instance dismisses the trust dialog, so community plugins do not auto-load). Enabling kicks off the bootstrap, which installs CodeScript Toolkit from the store.
    await evalInObsidian({
      args: { helperPluginId: HELPER_PLUGIN_ID },
      async fn({ app, helperPluginId }) {
        await app.plugins.loadManifests();
        await app.plugins.disablePlugin(helperPluginId);
        await app.plugins.enablePlugin(helperPluginId);
      },
      vaultPath
    });

    // Poll from the Node side (each eval is quick): the real store install can outlast CDP's single-command timeout, so the wait cannot live inside one closure.
    let didStartupRun = false;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !didStartupRun; attempt++) {
      didStartupRun = await evalInObsidian({
        args: { cstPluginId: CST_PLUGIN_ID },
        fn: ({ app, cstPluginId }): boolean => Reflect.get(window, '__demoVaultHelperStartupRan') === true && app.plugins.enabledPlugins.has(cstPluginId),
        vaultPath
      });
      if (!didStartupRun) {
        await sleep({ milliseconds: POLL_INTERVAL_IN_MILLISECONDS });
      }
    }

    // Gather diagnostics only on failure (the store install is network-dependent), so a flake reports how far the bootstrap got instead of a bare `false`.
    let diagnosticsMessage = '';
    if (!didStartupRun) {
      const diagnostics = await evalInObsidian({
        args: { cstPluginId: CST_PLUGIN_ID, helperPluginId: HELPER_PLUGIN_ID },
        fn({ app, cstPluginId, helperPluginId }) {
          let noticeText = '';
          for (const noticeEl of Array.from(document.querySelectorAll('.notice'))) {
            if (noticeEl.textContent.includes('Demo Vault Helper')) {
              noticeText = noticeEl.textContent;
            }
          }
          return {
            activeFilePath: app.workspace.getActiveFile()?.path ?? null,
            cstEnabled: app.plugins.enabledPlugins.has(cstPluginId),
            cstInstalled: Boolean(app.plugins.manifests[cstPluginId]),
            helperEnabled: app.plugins.enabledPlugins.has(helperPluginId),
            helperInstalled: Boolean(app.plugins.manifests[helperPluginId]),
            noticeText,
            probeValue: Reflect.get(window, '__demoVaultHelperProbeValue') ?? null,
            startupRan: Reflect.get(window, '__demoVaultHelperStartupRan') ?? null
          };
        },
        vaultPath
      });
      diagnosticsMessage = JSON.stringify(diagnostics);
    }

    expect(didStartupRun, diagnosticsMessage).toBe(true);

    const result = await evalInObsidian({
      args: { cstPluginId: CST_PLUGIN_ID },
      async fn({ app, cstPluginId }) {
        const dataPath = `${app.vault.configDir}/plugins/${cstPluginId}/data.json`;
        return {
          activeFilePath: app.workspace.getActiveFile()?.path ?? null,
          dataJson: await app.vault.adapter.read(dataPath),
          didRequireResolve: Reflect.get(window, '__demoVaultHelperProbeValue') === 'ok',
          isCstEnabled: app.plugins.enabledPlugins.has(cstPluginId),
          isCstInstalled: Boolean(app.plugins.manifests[cstPluginId])
        };
      },
      vaultPath
    });

    expect(result.isCstInstalled).toBe(true);
    expect(result.isCstEnabled).toBe(true);
    expect(result.dataJson).toContain(MODULES_ROOT);
    expect(result.dataJson).toContain('startupScriptPath');
    expect(result.activeFilePath).toBe(START_NOTE_PATH);
    expect(result.didRequireResolve).toBe(true);
  }, TEST_TIMEOUT_IN_MILLISECONDS);
});
