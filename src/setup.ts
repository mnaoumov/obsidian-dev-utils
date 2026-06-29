/**
 * @file
 *
 * Framework-agnostic test-setup endpoint for `obsidian-dev-utils`.
 *
 * Wires the library's per-test setup into a test framework's `beforeEach` / `afterEach` lifecycle
 * hooks. Before each test it resets the shared-state bag on `globalThis.__obsidianDevUtils` (so
 * accumulated state such as debuggers, queues, and registered handlers does not leak between tests),
 * resets the injected cosmetic global-state bag, and enables async-operation tracking; after
 * each test it disables tracking. Tests can therefore `await waitForAllAsyncOperations()` against a
 * clean, isolated state.
 *
 * This module has no import-time side effects and no dependency on any specific test framework. The
 * thin Vitest/Jest setup files (`vitest-setup.ts` / `jest-setup.ts`) call {@link setup} with the
 * hooks imported from their respective frameworks.
 */

import {
  disableAsyncOperationTracking,
  enableAsyncOperationTracking
} from './async.ts';
import { resetGlobalState } from './library.ts';
import { resetObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';

/**
 * A test-framework lifecycle hook registrar, such as `beforeEach` or `afterEach`.
 *
 * @param fn - The callback to register with the hook.
 */
export type HookRegistrar = (fn: () => void) => void;

/**
 * Parameters for {@link setup}.
 */
export interface SetupParams {
  /**
   * The test framework's `afterEach` hook registrar. Used to tear down per-test state after each test.
   */
  readonly afterEach: HookRegistrar;

  /**
   * The test framework's `beforeEach` hook registrar. Used to set up fresh per-test state before each test.
   */
  readonly beforeEach: HookRegistrar;
}

/**
 * Registers `obsidian-dev-utils` per-test setup with a test framework's lifecycle hooks.
 *
 * Before each test (via the supplied `beforeEach`) it resets the shared-state bag and the cosmetic
 * global-state bag, and enables async-operation tracking; after each test (via the supplied
 * `afterEach`) it disables tracking.
 *
 * @param params - The lifecycle hook registrars to wire setup into.
 */
export function setup(params: SetupParams): void {
  params.beforeEach(beforeEachHandler);
  params.afterEach(disableAsyncOperationTracking);
}

function beforeEachHandler(): void {
  resetObsidianDevUtilsState();
  resetGlobalState();
  enableAsyncOperationTracking();
}
