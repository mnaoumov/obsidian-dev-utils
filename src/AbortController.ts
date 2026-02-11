/**
 * @packageDocumentation
 *
 * AbortController utilities.
 */

import { noop } from './Function.ts';

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

  if (typeof AbortSignal.any === 'function') {
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

  const abortHandlerRemovers: (() => void)[] = [];

  for (const abortSignal of abortSignals) {
    abortHandlerRemovers.push(onAbort(abortSignal, handleAbort));
  }

  return abortController.signal;

  function handleAbort(abortSignal: AbortSignal): void {
    for (const abortHandlerRemover of abortHandlerRemovers) {
      abortHandlerRemover();
    }

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

  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutInMilliseconds);
  }

  const abortController = new AbortController();
  window.setTimeout(() => {
    abortController.abort(new Error(`Timed out in ${String(timeoutInMilliseconds)} milliseconds`));
  }, timeoutInMilliseconds);
  return abortController.signal;
}

/**
 * Adds an abort listener to an abort signal and calls the callback if the abort signal is already aborted.
 *
 * @param abortSignal - The abort signal to add the listener to.
 * @param callback - The callback to call when the abort signal aborts.
 * @returns A function to remove the abort listener.
 */
export function onAbort(abortSignal: AbortSignal, callback: (abortSignal: AbortSignal) => void): () => void {
  if (abortSignal.aborted) {
    callback(abortSignal);
    return noop;
  }

  abortSignal.addEventListener('abort', wrappedCallback, { once: true });
  return () => {
    abortSignal.removeEventListener('abort', wrappedCallback);
  };

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
