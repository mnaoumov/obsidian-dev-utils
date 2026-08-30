/**
 * @file
 *
 * Vitest global setup for the cross-copy plugin-API test.
 *
 * The vault has NO plugin-under-test (`installPlugin: false`). Instead it carries two purpose-built,
 * SEPARATELY BUNDLED community plugins — a provider and a consumer — each holding its own copy of
 * `obsidian-dev-utils`. That is the claim the companion test
 * (`src/obsidian/plugin/plugin-api.obsidian.integration.test.ts`) verifies and that no unit test can reach:
 * the registry record is a wire format between different library copies, so it must be read structurally,
 * never by class identity.
 *
 * The consumer is enabled FIRST, so its `onload` watches start before the provider exists — the load-order
 * problem, reproduced rather than avoided.
 */

import type { PopulateFilesParams } from 'obsidian-integration-testing';
import type { TestProject } from 'vitest/node';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

import { ObsidianPluginRepoPaths } from '../src/obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import { buildPluginApiTestPlugins } from './helpers/build-plugin-api-test-plugins.ts';

const PROJECT_ROOT = join(import.meta.dirname, '..');

/**
 * The `manifest.id` of the consuming plugin. Kept in step with `integration-test-plugin-api/shared.ts`, which
 * this Node-side setup cannot import: that module is compiled INTO the bundles.
 */
export const PLUGIN_API_CONSUMER_PLUGIN_ID = 'obsidian-dev-utils-plugin-api-consumer';

/**
 * The `manifest.id` of the providing plugin.
 */
export const PLUGIN_API_PROVIDER_PLUGIN_ID = 'obsidian-dev-utils-plugin-api-provider';

const setupPair = createSetup({
  // The consumer comes first on purpose: its watches must already be running when the provider publishes.
  enableCommunityPlugins: [PLUGIN_API_CONSUMER_PLUGIN_ID, PLUGIN_API_PROVIDER_PLUGIN_ID],
  installPlugin: false,
  populate: getPluginApiPopulate
});

/**
 * Vitest global setup: bundles both plugins, then delegates to the `createSetup` pair configured above.
 *
 * @param project - The Vitest test project.
 */
export async function setup(project: TestProject): Promise<void> {
  await buildPluginApiTestPlugins();
  await setupPair.setup(project);
}

/**
 * Vitest global teardown: disposes the owned instance and its vault.
 */
export async function teardown(): Promise<void> {
  await setupPair.teardown();
}

/**
 * Builds the populate map (invoked once, during setup) that seeds both plugins into the temp vault.
 *
 * @returns The populate map for the temp vault.
 */
function getPluginApiPopulate(): PopulateFilesParams {
  return {
    ...getPluginPopulate(ObsidianDevUtilsRepoPaths.DistPluginApiTestConsumer, PLUGIN_API_CONSUMER_PLUGIN_ID),
    ...getPluginPopulate(ObsidianDevUtilsRepoPaths.DistPluginApiTestProvider, PLUGIN_API_PROVIDER_PLUGIN_ID)
  };
}

/**
 * Builds the vault-relative file map for one built plugin.
 *
 * @param builtFolder - The repo-relative folder the plugin was built into.
 * @param pluginId - The `manifest.id` the plugin is seeded under.
 * @returns The map of vault-relative paths to file contents.
 */
function getPluginPopulate(builtFolder: string, pluginId: string): Record<string, Uint8Array> {
  const sourceFolder = join(PROJECT_ROOT, builtFolder);
  const vaultFolder = [ObsidianPluginRepoPaths.DotObsidian, ObsidianPluginRepoPaths.Plugins, pluginId].join('/');

  const populate: Record<string, Uint8Array> = {};
  for (const fileName of [ObsidianPluginRepoPaths.MainJs, ObsidianPluginRepoPaths.ManifestJson]) {
    populate[`${vaultFolder}/${fileName}`] = readFileSync(join(sourceFolder, fileName));
  }
  return populate;
}
