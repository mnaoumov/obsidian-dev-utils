/**
 * @file
 *
 * Vitest global setup for the consumer-path `lib` injection test.
 *
 * Proves the setup a CONSUMER plugin wires up, which this repo's own suites cannot: there, the harness plugin
 * IS the plugin-under-test, so `window.__obsidianDevUtilsModule` is present for free. Here the vault has NO
 * plugin-under-test at all (`installPlugin: false`) and the harness plugin rides along purely as a seeded,
 * enabled community plugin — exactly how it reaches a consumer's test vault, via the published
 * {@link getIntegrationTestPluginPopulate} + `enableCommunityPlugins` pair.
 *
 * The companion test (`src/integration-test-lib.obsidian.integration.test.ts`) then asserts that library
 * helpers are reachable as `lib.<helper>` inside an `evalInObsidian` closure.
 */

import type { PopulateFilesParams } from 'obsidian-integration-testing';
import type { TestProject } from 'vitest/node';

import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

import { ObsidianDevUtilsRepoPaths } from '../src/script-utils/obsidian-dev-utils-repo-paths.ts';
import {
  getIntegrationTestPluginPopulate,
  OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID
} from '../src/script-utils/test-runners/integration-test-plugin.ts';
import { buildIntegrationTestPlugin } from './helpers/build-integration-test-plugin.ts';

const setupPair = createSetup({
  enableCommunityPlugins: [OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID],
  installPlugin: false,
  populate: getConsumerLibPopulate
});

/**
 * Vitest global setup: builds the harness plugin into the folder the package SHIPS
 * (`dist/integration-test-plugin`), so {@link getIntegrationTestPluginPopulate} reads exactly the bytes a
 * consumer would get, then delegates to the `createSetup` pair configured above.
 *
 * @param project - The Vitest test project.
 */
export async function setup(project: TestProject): Promise<void> {
  await buildIntegrationTestPlugin({
    outDirectory: ObsidianDevUtilsRepoPaths.DistIntegrationTestPlugin,
    shouldGenerateSourceMap: false
  });
  await setupPair.setup(project);
}

/**
 * Vitest global teardown: disposes the owned instance and its vault.
 */
export async function teardown(): Promise<void> {
  await setupPair.teardown();
}

/**
 * Builds the populate map (invoked once, during setup) through the published helper — no extra fixtures, so
 * the only thing in the vault is the harness plugin itself.
 *
 * @returns The populate map for the temp vault.
 */
function getConsumerLibPopulate(): PopulateFilesParams {
  return getIntegrationTestPluginPopulate();
}
