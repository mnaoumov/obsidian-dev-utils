/**
 * @file
 *
 * Framework-agnostic test-setup endpoint for Obsidian plugins built on `@mnaoumov/obsidian-lib`.
 *
 * Does everything the generic `setup` from `@mnaoumov/typescript-test-toolkit/setup` does, and before each
 * test also resets the Obsidian half of the shared state: the `globalThis.__obsidianDevUtils` bag (queues,
 * registered handlers, the plugin-API registry) and the injected `ObsidianLibrary` context. It lives here
 * rather than in the test toolkit because the test toolkit must not depend on `@mnaoumov/obsidian-lib`.
 */

import type { SetupParams } from '@mnaoumov/typescript-test-toolkit/setup';

import { ObsidianLibrary } from '@mnaoumov/obsidian-lib/library';
import { resetObsidianDevUtilsState } from '@mnaoumov/obsidian-lib/obsidian-dev-utils-state';
import { setup as setupGeneric } from '@mnaoumov/typescript-test-toolkit/setup';

/**
 * Registers the per-test setup for an Obsidian plugin's tests with a test framework's lifecycle hooks.
 *
 * The Obsidian reset is registered first, so it runs before the generic one in every `beforeEach`, in the
 * same order the two ran in before they were split.
 *
 * @param params - The lifecycle hook registrars to wire setup into.
 */
export function setup(params: SetupParams): void {
  params.beforeEach(() => {
    resetObsidianDevUtilsState();
    ObsidianLibrary.resetToDefault();
  });
  setupGeneric(params);
}
