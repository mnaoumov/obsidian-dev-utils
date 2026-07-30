/**
 * @file
 *
 * Wires the shipped integration-test harness plugin into a consumer plugin's integration tests, so every
 * library helper is reachable as `lib.<helper>` inside an `evalInObsidian` closure.
 *
 * Two halves, and both must be wired or `lib.<helper>` fails:
 *
 * - {@link getIntegrationTestPluginPopulate} puts the harness plugin's binaries in the test vault. The
 *   harness plugin is what publishes the library on `window.__obsidianDevUtilsModule`; in this repo's own
 *   suite it IS the plugin-under-test, but in a consumer's suite the plugin-under-test is the consumer's own
 *   plugin, so the harness has to ride along as a second, test-only community plugin — seeded here, and
 *   turned on by `obsidian-integration-testing`'s `createSetup({ enableCommunityPlugins })`.
 * - {@link registerIntegrationTestLibResolver} registers the renderer-side resolver that reads that global.
 *
 * `obsidian-dev-utils/integration-test-vitest-global-setup` and
 * `obsidian-dev-utils/integration-test-setup` are the turnkey endpoints that call these for you.
 */

import { readFileSync } from 'node:fs';
import { registerLibResolver } from 'obsidian-integration-testing';

import { ObsidianPluginRepoPaths } from '../../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import {
  getFolderName,
  join
} from '../../path.ts';
import { ObsidianDevUtilsRepoPaths } from '../obsidian-dev-utils-repo-paths.ts';
import { getRootFolder } from '../root.ts';

/**
 * The id of the integration-test harness plugin — the folder name it is seeded into, and the value to pass
 * to `createSetup({ enableCommunityPlugins })` so the harness enables it after the plugin-under-test.
 */
export const OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID = 'obsidian-dev-utils-integration-test';

/**
 * The flat library barrel the harness plugin publishes.
 */
interface ObsidianDevUtilsModule {
  __merged: object;
}

/**
 * The shape the harness plugin publishes on the renderer's `window`.
 */
interface ObsidianDevUtilsModuleWindow {
  __obsidianDevUtilsModule: ObsidianDevUtilsModule;
}

/**
 * Builds the vault-relative file map that installs the shipped integration-test harness plugin, ready to
 * hand to a global setup's `populate` (or to merge into a larger map the consumer already builds).
 *
 * The result is a `Record<string, Uint8Array>`, which is assignable to `obsidian-integration-testing`'s
 * `PopulateFilesParams` — so it composes with `buildDemoVaultPopulate` and friends.
 *
 * @returns The map of vault-relative paths to file contents.
 * @throws If the harness plugin was not built into this package — i.e. `npm run build` never ran.
 */
export function getIntegrationTestPluginPopulate(): Record<string, Uint8Array> {
  const packageFolder = getRootFolder(getFolderName(import.meta.url));
  if (!packageFolder) {
    throw new Error('Could not resolve the obsidian-dev-utils package folder to seed the integration-test harness plugin.');
  }

  const pluginSourceFolder = join(packageFolder, ObsidianDevUtilsRepoPaths.DistIntegrationTestPlugin);
  const pluginVaultFolder = join(
    ObsidianPluginRepoPaths.DotObsidian,
    ObsidianPluginRepoPaths.Plugins,
    OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID
  );

  const populate: Record<string, Uint8Array> = {};

  for (const fileName of [ObsidianPluginRepoPaths.MainJs, ObsidianPluginRepoPaths.ManifestJson]) {
    const sourcePath = join(pluginSourceFolder, fileName);
    let content: Uint8Array;
    try {
      content = readFileSync(sourcePath);
    } catch (error: unknown) {
      throw new Error(
        `Could not read ${sourcePath}. The integration-test harness plugin is missing from the installed `
          + 'obsidian-dev-utils package — run `npm run build` in obsidian-dev-utils, or reinstall it.',
        { cause: error }
      );
    }
    populate[join(pluginVaultFolder, fileName)] = content;
  }

  return populate;
}

/**
 * Registers the renderer-side resolver that merges the whole library into the `lib` argument of every
 * `evalInObsidian` callback, reading it from the global the harness plugin publishes.
 *
 * Call once per test worker — the published `obsidian-dev-utils/integration-test-setup` endpoint does it
 * for you when listed in `setupFiles`. Registration is idempotent (the harness dedupes resolvers by source
 * text), so calling it more than once is safe.
 */
export function registerIntegrationTestLibResolver(): void {
  registerLibResolver((): object => {
    const obsidianDevUtilsModule = (window as Partial<ObsidianDevUtilsModuleWindow>).__obsidianDevUtilsModule;
    if (!obsidianDevUtilsModule) {
      throw new Error(
        'The obsidian-dev-utils module is not exposed on `window`. Is the obsidian-dev-utils integration-test '
          + 'harness plugin installed and enabled in the test vault? See '
          + '`obsidian-dev-utils/integration-test-vitest-global-setup`.'
      );
    }
    return obsidianDevUtilsModule.__merged;
  });
}
