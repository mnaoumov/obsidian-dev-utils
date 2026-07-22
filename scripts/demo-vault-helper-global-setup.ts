/**
 * @file
 *
 * Vitest global setup for the `demo-vault-helper` bootstrap integration test.
 *
 * Builds the committed `demo-vault-helper` plugin, materializes a throwaway demo vault holding the
 * CodeScript Toolkit startup + probe scripts and a start note, seeds the helper's built binaries via
 * {@link buildDemoVaultPopulate}, then runs `createSetup({ installPlugin: false, enableCommunityPlugins })`
 * to register the vault and enable the helper through the harness's retry/load-verify path — there is no
 * plugin-under-test, this vault is dedicated to exercising the helper's bootstrap in isolation (rather than
 * polluting the shared harness vault the other `*.obsidian.integration.test.ts` files use).
 *
 * The companion test (`src/obsidian/demo-vault-helper.obsidian.integration.test.ts`) polls from a worker and
 * asserts the helper installed + configured + enabled CodeScript Toolkit, ran its `startup.ts`, opened the
 * start note, and resolved a probe module — all with no manual reload.
 */

import type { PopulateFilesParams } from 'obsidian-integration-testing';
import type { TestProject } from 'vitest/node';

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDemoVaultPopulate } from 'obsidian-integration-testing';
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

import { buildDemoVaultHelper } from './helpers/build-demo-vault-helper.ts';

const HELPER_PLUGIN_ID = 'demo-vault-helper';
const START_NOTE_PATH = '00 Start.md';
const MODULES_ROOT = '_assets/CodeScriptToolkit';
// CodeScript Toolkit resolves a single leading `/` against `modulesRoot`, so `/probe.ts` is `<modulesRoot>/probe.ts`.
const PROBE_MODULE_PATH = '/probe.ts';

const DIST_HELPER_DIR = join(import.meta.dirname, '../dist/demo-vault-helper');

const PROBE_MODULE = 'export const PROBE = \'ok\';\n';

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

let demoVaultPath: string | undefined;

const setupPair = createSetup({
  enableCommunityPlugins: [HELPER_PLUGIN_ID],
  installPlugin: false,
  populate: buildDemoVaultPopulateForHelperTest
});

/**
 * Vitest global setup: builds the `demo-vault-helper` bundle (so {@link buildDemoVaultPopulateForHelperTest}
 * finds its binaries on disk), then delegates to the `createSetup` pair configured above.
 *
 * @param project - The Vitest test project.
 */
export async function setup(project: TestProject): Promise<void> {
  await buildDemoVaultHelper();
  await setupPair.setup(project);
}

/**
 * Vitest global teardown: disposes the owned instance/vault, then removes the throwaway demo vault.
 */
export async function teardown(): Promise<void> {
  try {
    await setupPair.teardown();
  } finally {
    if (demoVaultPath) {
      rmSync(demoVaultPath, { force: true, recursive: true });
    }
  }
}

/**
 * Builds the populate map (invoked once, during setup): materializes a throwaway demo vault holding the start
 * note plus the CodeScript Toolkit probe + startup scripts, then composes it with {@link buildDemoVaultPopulate},
 * injecting the built `demo-vault-helper` binaries. No CodeScript Toolkit config is seeded — the helper writes
 * it at runtime.
 *
 * @returns The populate map for the temp vault.
 */
function buildDemoVaultPopulateForHelperTest(): PopulateFilesParams {
  demoVaultPath = mkdtempSync(join(tmpdir(), 'demo-vault-helper-'));
  writeFileSync(join(demoVaultPath, START_NOTE_PATH), '# Start\n');

  const modulesDir = join(demoVaultPath, MODULES_ROOT);
  mkdirSync(modulesDir, { recursive: true });
  writeFileSync(join(modulesDir, 'probe.ts'), PROBE_MODULE);
  writeFileSync(join(modulesDir, 'startup.ts'), STARTUP_SCRIPT);

  return buildDemoVaultPopulate({
    demoVaultPath,
    injectPlugins: [{ pluginId: HELPER_PLUGIN_ID, sourceDir: DIST_HELPER_DIR }]
  });
}
