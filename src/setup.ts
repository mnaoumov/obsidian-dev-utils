/**
 * @file
 *
 * Framework-agnostic test-setup endpoint for `obsidian-dev-utils`.
 *
 * Wires the library's per-test setup into a test framework's `beforeEach` / `afterEach` lifecycle
 * hooks. Before each test it resets the shared-state bag on `globalThis.__obsidianDevUtils` (so
 * accumulated state such as debuggers, queues, and registered handlers does not leak between tests),
 * resets the injected {@link Library} state (so the next test can re-initialize), enables
 * async-operation tracking, silences every `console` method (so incidental log/warn/error output
 * does not pollute the test report), clears `localStorage` (so per-worker Web Storage state does not
 * leak between tests), and starts collecting unhandled async errors; after each test it drains any
 * tracked fire-and-forget operations **and the pending macrotask queue**, disables tracking, restores
 * the original `console` methods, and fails the test with an `AggregateError` if any unhandled async
 * error was emitted. A registered consumer handler does not exempt an error — only
 * {@link error!startAsyncErrorIgnoreContext} does. The collection window deliberately stays open between
 * tests and is closed by an `afterAll`, so an error emitted in the gap after a test (typically by a
 * `setTimeout` it left pending) fails the run instead of printing to a restored `console` and being
 * dropped. It also installs {@link installWarningsAsErrors} once, so any Node process
 * warning fails the run. Tests can therefore `await waitForAllAsyncOperations()` against a clean, isolated state, and a
 * test that needs to assert on console output can re-instrument the method it cares about (e.g.
 * `vi.spyOn(console, 'error')`), which transparently overrides the no-op for that test.
 *
 * This module has no import-time side effects and no dependency on any specific test framework. The
 * thin Vitest/Jest setup files (`vitest-setup.ts` / `jest-setup.ts`) call {@link setup} with the
 * hooks imported from their respective frameworks.
 */

import {
  disableAsyncOperationTracking,
  enableAsyncOperationTracking,
  isAsyncOperationTrackingEnabled,
  waitForAllAsyncOperations
} from './async.ts';
import {
  drainCollectedUnhandledAsyncErrors,
  startCollectingUnhandledAsyncErrors,
  stopCollectingUnhandledAsyncErrors
} from './error.ts';
import { noop } from './function.ts';
import { Library } from './library.ts';
import { resetObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';
import { installWarningsAsErrors } from './script-utils/warnings-as-errors.ts';
import { ensureNonNullable } from './type-guards.ts';

/**
 * A test-framework lifecycle hook registrar, such as `beforeEach` or `afterEach`.
 *
 * @param fn - The callback to register with the hook.
 */
export type HookRegistrar = ($function: () => Promise<void> | void) => void;

/**
 * Parameters for {@link setup}.
 */
export interface SetupParams {
  /**
   * The test framework's `afterAll` hook registrar. Used to close the unhandled-async-error collection
   * window once the file's last test has run, so an error emitted after it still fails the run.
   */
  readonly afterAll: HookRegistrar;

  /**
   * The test framework's `afterEach` hook registrar. Used to tear down per-test state after each test.
   */
  readonly afterEach: HookRegistrar;

  /**
   * The test framework's `beforeEach` hook registrar. Used to set up fresh per-test state before each test.
   */
  readonly beforeEach: HookRegistrar;
}

const CONSOLE_METHOD_NAMES = [
  'assert',
  'count',
  'countReset',
  'debug',
  'dir',
  'dirxml',
  'error',
  'group',
  'groupCollapsed',
  'groupEnd',
  'info',
  'log',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'trace',
  'warn'
] as const satisfies readonly (keyof Console)[];

type ConsoleMethodName = (typeof CONSOLE_METHOD_NAMES)[number];

const originalConsoleMethodDescriptors = new Map<ConsoleMethodName, PropertyDescriptor>();

// Captured at module load, which is before any test can install fake timers. Draining teardown through a
// Faked `setTimeout` would never resolve, hanging every test that left `vi.useFakeTimers()` on.
// eslint-disable-next-line obsidianmd/no-global-this, unicorn/no-unnecessary-global-this -- Intentional: `globalThis.setTimeout` (not `window`) so teardown also works under `environment: 'node'`, where `window` is undefined; the specific window is irrelevant for a plain timer. The explicit `globalThis` is also what keeps the sibling `obsidianmd/prefer-window-timers` rule from rewriting it back to `window`.
const scheduleMacrotask = globalThis.setTimeout.bind(globalThis);

/**
 * Restores every `console` method previously replaced by {@link silenceConsole} to its original implementation.
 */
export function restoreConsole(): void {
  for (const [methodName, descriptor] of originalConsoleMethodDescriptors) {
    Object.defineProperty(console, methodName, descriptor);
  }
}

/**
 * Registers `obsidian-dev-utils` per-test setup with a test framework's lifecycle hooks.
 *
 * Installs {@link installWarningsAsErrors} (once) so any Node process warning fails the run. Before
 * each test (via the supplied `beforeEach`) it resets the shared-state bag and the injected
 * {@link Library} state, enables async-operation tracking, silences the `console`, clears
 * `localStorage`, and starts collecting unhandled async errors; after each test (via the supplied
 * `afterEach`) it drains tracked fire-and-forget operations and the pending macrotask queue, disables
 * tracking, restores the `console`, and fails the test if any unhandled async error was emitted. The
 * collection window stays open between tests and is closed by the supplied `afterAll`, so an error
 * emitted in a gap fails the run rather than being dropped.
 *
 * @param params - The lifecycle hook registrars to wire setup into.
 */
export function setup(params: SetupParams): void {
  installWarningsAsErrors();
  params.beforeEach(beforeEachHandler);
  params.afterEach(afterEachHandler);
  params.afterAll(afterAllHandler);
}

/**
 * Replaces every `console` method with a no-op so incidental output does not pollute the test report.
 *
 * The original implementations are captured on first use and restored by {@link restoreConsole}. A test
 * that needs to assert on console output can re-instrument the method it cares about (e.g.
 * `vi.spyOn(console, 'error')`), transparently overriding the no-op for that test.
 */
export function silenceConsole(): void {
  for (const methodName of CONSOLE_METHOD_NAMES) {
    if (!originalConsoleMethodDescriptors.has(methodName)) {
      const descriptor = ensureNonNullable(Object.getOwnPropertyDescriptor(console, methodName));
      originalConsoleMethodDescriptors.set(methodName, descriptor);
    }

    Object.defineProperty(console, methodName, {
      configurable: true,
      enumerable: true,
      value: noop,
      writable: true
    });
  }
}

async function afterAllHandler(): Promise<void> {
  // The last test's leftovers have no next `beforeEach` to report them, so drain once more and only then
  // Close the window for the file.
  await drainPendingMacrotasks();
  throwOnUnhandledAsyncErrors(stopCollectingUnhandledAsyncErrors(), 'after the last test finished');
}

async function afterEachHandler(): Promise<void> {
  // Drain fire-and-forget operations first so any that reject emit their async error before we check.
  // Skip when a test disabled tracking itself, since waitForAllAsyncOperations would then throw.
  if (isAsyncOperationTrackingEnabled()) {
    await waitForAllAsyncOperations();
  }

  // A `setTimeout(..., 0)` the test left pending is not a tracked operation, so the drain above does not
  // Wait for it. Let the macrotask queue turn over — otherwise the error it emits lands in the gap between
  // Tests and is attributed to the wrong test (or, after the file's last test, to none at all).
  await drainPendingMacrotasks();
  if (isAsyncOperationTrackingEnabled()) {
    await waitForAllAsyncOperations();
  }

  disableAsyncOperationTracking();
  restoreConsole();

  // Deliberately NOT `stopCollectingUnhandledAsyncErrors()`: the window stays open across the gap to the
  // Next test, so an error emitted there is still collected instead of vanishing.
  throwOnUnhandledAsyncErrors(drainCollectedUnhandledAsyncErrors(), 'during the test');
}

function beforeEachHandler(): void {
  // Anything collected before the window was reset below was emitted after the previous test's `afterEach`
  // Drained it, i.e. between tests.
  const errorsBetweenTests = drainCollectedUnhandledAsyncErrors();

  resetObsidianDevUtilsState();
  Library.resetToDefault();
  enableAsyncOperationTracking();
  silenceConsole();
  clearLocalStorage();
  startCollectingUnhandledAsyncErrors();

  throwOnUnhandledAsyncErrors(errorsBetweenTests, 'after the previous test finished');
}

function clearLocalStorage(): void {
  // eslint-disable-next-line no-restricted-globals, n/no-unsupported-features/node-builtins -- Test setup: clearing per-worker localStorage; guarded, and provided only where node supports it.
  if (typeof localStorage !== 'undefined') {
    // eslint-disable-next-line no-restricted-globals, n/no-unsupported-features/node-builtins -- Test setup: clearing per-worker localStorage.
    localStorage.clear();
  }
}

// Deliberately NOT `sleep()` from `./async.ts`, the usual fixed-delay helper: it resolves through the LIVE
// `globalThis.setTimeout`, so a test that left `vi.useFakeTimers()` on — by throwing before its
// `vi.useRealTimers()`, say — would hang teardown forever instead of reporting the failure.
async function drainPendingMacrotasks(): Promise<void> {
  await new Promise<void>((resolve) => {
    scheduleMacrotask(resolve, 0);
  });
}

function throwOnUnhandledAsyncErrors(asyncErrors: readonly unknown[], when: string): void {
  if (asyncErrors.length === 0) {
    return;
  }

  throw new AggregateError(
    asyncErrors,
    `${String(asyncErrors.length)} unhandled async error(s) occurred ${when}.`
  );
}
