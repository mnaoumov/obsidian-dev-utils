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

/**
 * Registers a process `'warning'` listener that turns every Node warning into a test failure.
 *
 * Idempotent: calling it more than once (e.g. from several setup files sharing one worker) registers
 * the listener at most once, so it does not itself trigger a `MaxListenersExceededWarning`.
 */
export function installWarningsAsErrors(): void {
  if (process.listeners('warning').includes(throwOnWarning)) {
    return;
  }

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
