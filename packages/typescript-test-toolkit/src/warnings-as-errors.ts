/**
 * @file
 *
 * Turns Node process warnings into test failures.
 *
 * A Node `'warning'` event (e.g. an `ExperimentalWarning`, a `DeprecationWarning`, or a
 * `MaxListenersExceededWarning`) normally prints to `stderr` and is otherwise ignored. During tests
 * that silently hides real problems — the environment or a dependency is doing something Node flags as
 * risky, and the signal scrolls past unread. {@link installWarningsAsErrors} registers a `'warning'`
 * listener that rethrows, surfacing as an uncaught exception so the test run fails. This forces the
 * underlying cause to be addressed (or the warning to be eliminated at its source) rather than masked.
 */

import process from 'node:process';

/*
 * Marks the registered listener so a LATER call recognizes it without comparing function identity.
 *
 * `process` is shared by every module realm in one worker, but a VM-backed Vitest pool (`vmThreads` /
 * `vmForks`) evaluates this module once per test file, so each file gets its OWN `throwOnWarning`
 * object. An `includes(throwOnWarning)` check therefore never matches a listener another realm
 * registered, every file appends one more, and Node's own `MaxListenersExceededWarning` fires at the
 * eleventh — which this very listener then rethrows, failing a file that did nothing wrong.
 * `Symbol.for` is what makes the check survive that boundary: the global symbol registry is per
 * isolate, and VM contexts share their worker's isolate, so all realms read the same key.
 */
const THROW_ON_WARNING_LISTENER_MARKER = Symbol.for('obsidian-dev-utils:throwOnWarning');

/**
 * Registers a process `'warning'` listener that turns every Node warning into a test failure.
 *
 * Idempotent: calling it more than once (e.g. from several setup files sharing one worker) registers
 * the listener at most once, so it does not itself trigger a `MaxListenersExceededWarning`. The check
 * is by marker rather than by function identity, so it holds across module realms as well — under a
 * VM-backed pool each test file evaluates this module separately and an identity check would miss.
 */
export function installWarningsAsErrors(): void {
  if (process.listeners('warning').some((listener) => isThrowOnWarningListener(listener))) {
    return;
  }

  Object.defineProperty(throwOnWarning, THROW_ON_WARNING_LISTENER_MARKER, {
    configurable: true,
    enumerable: false,
    value: true,
    writable: false
  });
  process.on('warning', throwOnWarning);
}

/**
 * A process `'warning'` listener that rethrows the warning as an error, failing the test run.
 *
 * @param warning - The warning emitted by Node.
 * @throws Always — an {@link Error} wrapping the warning (with the original attached as its `cause`).
 */
export function throwOnWarning(warning: Error): never {
  throw new Error(`Node emitted a warning, which is treated as a test failure: ${warning.name}: ${warning.message}`, { cause: warning });
}

function isThrowOnWarningListener(listener: unknown): boolean {
  return (listener as Partial<Record<symbol, unknown>>)[THROW_ON_WARNING_LISTENER_MARKER] === true;
}
