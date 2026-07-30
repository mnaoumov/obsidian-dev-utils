/**
 * @file
 *
 * Per-worker integration-test setup endpoint: makes every library helper reachable as `lib.<helper>` inside
 * an `evalInObsidian` closure.
 *
 * Add it to the `setupFiles` of each integration-test project, after `obsidian-integration-testing`'s own
 * setup:
 *
 * ```ts
 * setupFiles: [
 *   'obsidian-integration-testing/vitest-setup',
 *   'obsidian-dev-utils/integration-test-setup'
 * ]
 * ```
 *
 * Importing this module registers a renderer-side resolver whose result the harness merges into the `lib`
 * argument of every `evalInObsidian` callback. Two more pieces are needed for `lib.<helper>` to work:
 *
 * - The **harness plugin** must be loaded in the test vault, because it is what publishes the library on
 *   `window.__obsidianDevUtilsModule`. Seed and enable it via
 *   `obsidian-dev-utils/integration-test-vitest-global-setup` (or, when composing with your own vault
 *   fixtures, {@link getIntegrationTestPluginPopulate} +
 *   `createSetup({ enableCommunityPlugins: [OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID] })`).
 * - The **types** must be activated, or `lib.<helper>` will not compile. Put
 *   `/// <reference types="obsidian-dev-utils/@types/obsidian-integration-testing" />` in a `.d.ts` your
 *   `tsconfig.json` already includes. A `compilerOptions.types` entry does NOT work for this.
 *
 * Registration is idempotent (the harness dedupes resolvers by source text), so importing this module from
 * more than one setup file is safe.
 */

/* v8 ignore start -- Thin setup-file glue; exercised end-to-end by the Obsidian integration suites. */
import { registerIntegrationTestLibResolver } from './script-utils/test-runners/integration-test-plugin.ts';

registerIntegrationTestLibResolver();
/* v8 ignore stop */
