/**
 * @file
 *
 * Framework-agnostic test-setup endpoint for async-operation tracking.
 *
 * Wires {@link enableAsyncOperationTracking} / {@link disableAsyncOperationTracking} into a test
 * framework's `beforeEach` / `afterEach` lifecycle hooks. Each test gets a fresh tracking session:
 * tracking is enabled before the test runs and disabled (clearing any tracked operations) after it
 * finishes, so a test can `await waitForAllAsyncOperations()` without leaking module-global state into
 * the next test.
 *
 * This module has no import-time side effects and no dependency on any specific test framework. The
 * thin Vitest/Jest setup files (`async-operation-tracking-vitest-setup.ts` /
 * `async-operation-tracking-jest-setup.ts`) call {@link setupAsyncOperationTracking} with the hooks
 * imported from their respective frameworks.
 */

import {
  disableAsyncOperationTracking,
  enableAsyncOperationTracking
} from '../async.ts';

/**
 * A test-framework lifecycle hook registrar, such as `beforeEach` or `afterEach`.
 *
 * @param fn - The callback to register with the hook.
 */
export type HookRegistrar = (fn: () => void) => void;

/**
 * Parameters for {@link setupAsyncOperationTracking}.
 */
export interface SetupAsyncOperationTrackingParams {
  /**
   * The test framework's `afterEach` hook registrar. Used to disable async-operation tracking after
   * each test.
   */
  readonly afterEach: HookRegistrar;

  /**
   * The test framework's `beforeEach` hook registrar. Used to enable async-operation tracking before
   * each test.
   */
  readonly beforeEach: HookRegistrar;
}

/**
 * Registers async-operation tracking with a test framework's lifecycle hooks.
 *
 * Enables tracking before each test (via the supplied `beforeEach`) and disables it after each test
 * (via the supplied `afterEach`), so every test runs with a fresh tracking session.
 *
 * @param params - The lifecycle hook registrars to wire tracking into.
 */
export function setupAsyncOperationTracking(params: SetupAsyncOperationTrackingParams): void {
  params.beforeEach(enableAsyncOperationTracking);
  params.afterEach(disableAsyncOperationTracking);
}
