/**
 * @file
 *
 * Turnkey Vitest `globalSetup` for a plugin's integration tests: does everything
 * `obsidian-integration-testing`'s own global setup does (temp vault, install and enable the
 * plugin-under-test), and additionally seeds and enables the `obsidian-dev-utils` integration-test harness
 * plugin, so `lib.<helper>` works inside `evalInObsidian` closures.
 *
 * ```ts
 * globalSetup: ['obsidian-dev-utils/integration-test-vitest-global-setup'],
 * setupFiles: [
 *   'obsidian-integration-testing/vitest-setup',
 *   'obsidian-dev-utils/integration-test-setup'
 * ]
 * ```
 *
 * Replaces `obsidian-integration-testing/vitest-global-setup-plugin`; do not list both.
 *
 * If the project already needs its own `populate` (demo-vault fixtures, a large performance vault), skip
 * this module and compose instead — merge {@link getIntegrationTestPluginPopulate} into that map and pass
 * {@link OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID} to `enableCommunityPlugins`:
 *
 * ```ts
 * export const { setup, teardown } = createSetup({
 *   enableCommunityPlugins: [OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID],
 *   populate: () => ({ ...myFixtures(), ...getIntegrationTestPluginPopulate() })
 * });
 * ```
 */

/* v8 ignore start -- Thin global-setup glue; exercised end-to-end by the Obsidian integration suites. */
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

import {
  getIntegrationTestPluginPopulate,
  OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID
} from './script-utils/test-runners/integration-test-plugin.ts';

const globalSetup = createSetup({
  enableCommunityPlugins: [OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID],
  populate: getIntegrationTestPluginPopulate
});

/**
 * Vitest global setup: creates the temp vault, installs and enables the plugin-under-test, then seeds and
 * enables the `obsidian-dev-utils` integration-test harness plugin alongside it.
 */
export const setup = globalSetup.setup;

/**
 * Vitest global teardown: removes the temp vault and disposes the transport.
 */
export const teardown = globalSetup.teardown;
/* v8 ignore stop */
