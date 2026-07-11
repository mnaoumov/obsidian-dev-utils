/**
 * @file
 *
 * Framework-agnostic test-setup endpoint for `obsidian-dev-utils`.
 *
 * Wires the library's per-test setup into a test framework's `beforeEach` / `afterEach` lifecycle
 * hooks. Before each test it resets the shared-state bag on `globalThis.__obsidianDevUtils` (so
 * accumulated state such as debuggers, queues, and registered handlers does not leak between tests),
 * resets the injected {@link Library} state (so the next test can re-initialize), enables
 * async-operation tracking, and silences every `console` method (so incidental log/warn/error output
 * does not pollute the test report); after each test it disables tracking and restores the original
 * `console` methods. Tests can therefore `await waitForAllAsyncOperations()` against a clean, isolated
 * state, and a test that needs to assert on console output can re-instrument the method it cares about
 * (e.g. `vi.spyOn(console, 'error')`), which transparently overrides the no-op for that test.
 *
 * This module has no import-time side effects and no dependency on any specific test framework. The
 * thin Vitest/Jest setup files (`vitest-setup.ts` / `jest-setup.ts`) call {@link setup} with the
 * hooks imported from their respective frameworks.
 */

import {
  disableAsyncOperationTracking,
  enableAsyncOperationTracking
} from './async.ts';
import { noop } from './function.ts';
import { Library } from './library.ts';
import { resetObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';
import { ensureNonNullable } from './type-guards.ts';

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
 * Before each test (via the supplied `beforeEach`) it resets the shared-state bag and the injected
 * {@link Library} state, enables async-operation tracking, and silences the `console`; after each
 * test (via the supplied `afterEach`) it disables tracking and restores the `console`.
 *
 * @param params - The lifecycle hook registrars to wire setup into.
 */
export function setup(params: SetupParams): void {
  params.beforeEach(beforeEachHandler);
  params.afterEach(afterEachHandler);
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

function afterEachHandler(): void {
  disableAsyncOperationTracking();
  restoreConsole();
}

function beforeEachHandler(): void {
  resetObsidianDevUtilsState();
  Library.resetToDefault();
  enableAsyncOperationTracking();
  silenceConsole();
}
