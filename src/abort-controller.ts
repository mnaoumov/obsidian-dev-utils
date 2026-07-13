/**
 * @file
 *
 * AbortController utilities.
 */

import {
  CallbackDisposable,
  CombineDisposable
} from './disposable.ts';
import { noop } from './function.ts';

/**
 * A constant representing an infinite timeout.
 */
export const INFINITE_TIMEOUT = Number.POSITIVE_INFINITY;

/**
 * An abort signal that aborts when any of the given abort signals abort.
 *
 * @param maybeAbortSignals - The abort signals to abort when any of them abort.
 * @returns The abort signal that aborts when any of the given abort signals abort.
 */
export function abortSignalAny(...maybeAbortSignals: (AbortSignal | undefined)[]): AbortSignal {
  const abortSignals = maybeAbortSignals.filter((abortSignal) => !!abortSignal);

  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `AbortSignal.any` is feature-detected here with a manual fallback below, so it is not required on older Obsidian/Electron (Chromium) versions that lack it.
  if (typeof AbortSignal.any === 'function') {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `AbortSignal.any` is feature-detected by the guard above with a manual fallback below, so it is not required on older Obsidian/Electron (Chromium) versions that lack it.
    return AbortSignal.any(abortSignals);
  }

  if (abortSignals.length === 0) {
    return abortSignalNever();
  }

  if (abortSignals.length === 1 && abortSignals[0]) {
    return abortSignals[0];
  }

  const abortController = new AbortController();

  for (const abortSignal of abortSignals) {
    if (abortSignal.aborted) {
      return abortSignal;
    }
  }

  const abortHandlerDisposables: Disposable[] = [];

  for (const abortSignal of abortSignals) {
    abortHandlerDisposables.push(onAbort(abortSignal, handleAbort));
  }

  const combinedAbortHandlerDisposable = new CombineDisposable({ disposables: abortHandlerDisposables });

  return abortController.signal;

  function handleAbort(abortSignal: AbortSignal): void {
    combinedAbortHandlerDisposable.dispose();
    abortController.abort(abortSignal.reason);
  }
}

/**
 * An abort signal that never aborts.
 *
 * @returns The abort signal that never aborts.
 */
export function abortSignalNever(): AbortSignal {
  return new AbortController().signal;
}

/**
 * An abort signal that aborts after a timeout.
 *
 * @param timeoutInMilliseconds - The timeout in milliseconds.
 * @returns The abort signal that aborts after a timeout.
 */
export function abortSignalTimeout(timeoutInMilliseconds: number): AbortSignal {
  if (timeoutInMilliseconds === INFINITE_TIMEOUT) {
    return abortSignalNever();
  }

  // Intentionally NOT the native `AbortSignal.timeout`, whose internal timer cannot be advanced by
  // `vi.useFakeTimers()`, so `sleep` (its sole consumer) would be uncontrollable in tests. Building
  // `sleep`'s signal off `globalThis.setTimeout` keeps it fake-timer controllable (like
  // `setTimeoutAsync`) and also works in a Node environment where `window` is undefined, since
  // `globalThis` exists in Node too. Consumer integration-test projects run vitest under
  // `environment: 'node'`, in which a `window`-based primitive throws a `ReferenceError`.
  // The abort reason mirrors the native one -- a `DOMException` named `TimeoutError` -- matching
  // `AbortSignal.timeout` for `reason.name` checks.
  const abortController = new AbortController();
  // eslint-disable-next-line obsidianmd/no-global-this -- Intentional: `globalThis.setTimeout` (not `window`) so this timeout primitive also works in a Node environment where `window` is undefined; the specific window is irrelevant for a plain timer.
  globalThis.setTimeout(() => {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `DOMException` is a DOM global always present in the Obsidian/Electron (Chromium) runtime this code targets, and is also a Node global from Node 17 onward.
    abortController.abort(new DOMException(`Timed out in ${String(timeoutInMilliseconds)} milliseconds`, 'TimeoutError'));
  }, timeoutInMilliseconds);
  return abortController.signal;
}

/**
 * Adds an abort listener to an abort signal and calls the callback if the abort signal is already aborted.
 *
 * @param abortSignal - The abort signal to add the listener to.
 * @param callback - The callback to call when the abort signal aborts.
 * @returns A {@link Disposable} that removes the abort listener when disposed, for use with `using`.
 */
export function onAbort(abortSignal: AbortSignal, callback: (abortSignal: AbortSignal) => void): Disposable {
  if (abortSignal.aborted) {
    callback(abortSignal);
    return new CallbackDisposable({ callback: noop });
  }

  abortSignal.addEventListener('abort', wrappedCallback, { once: true });
  return new CallbackDisposable({
    callback: (): void => {
      abortSignal.removeEventListener('abort', wrappedCallback);
    }
  });

  function wrappedCallback(evt: Event): void {
    callback(evt.target as AbortSignal);
  }
}

/**
 * Waits for an abort signal to abort and resolves with its reason.
 *
 * @typeParam T - Expected type of `abortSignal.reason`.
 * @param abortSignal - The abort signal to wait for.
 * @returns A {@link Promise} that resolves with the reason of the abort signal.
 */
export function waitForAbort<T = unknown>(abortSignal: AbortSignal): Promise<T>;
/**
 * Waits for an abort signal to abort and rejects with its reason.
 *
 * @param abortSignal - The abort signal to wait for.
 * @param shouldRejectOnAbort - Whether to reject the promise if the abort signal is aborted.
 * @returns A {@link Promise} that rejects with the reason of the abort signal.
 */
export function waitForAbort(abortSignal: AbortSignal, shouldRejectOnAbort: true): Promise<never>;
/**
 * Waits for an abort signal to abort and resolves with its reason.
 *
 * @typeParam T - Expected type of `abortSignal.reason`.
 * @param abortSignal - The abort signal to wait for.
 * @param shouldRejectOnAbort - Whether to reject the promise if the abort signal is aborted.
 * @returns A {@link Promise} that resolves with the reason of the abort signal.
 */
export function waitForAbort<T = unknown>(abortSignal: AbortSignal, shouldRejectOnAbort?: boolean): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    onAbort(abortSignal, () => {
      if (shouldRejectOnAbort) {
        reject(abortSignal.reason as Error);
      } else {
        resolve(abortSignal.reason as T);
      }
    });
  });
}
