/**
 * @packageDocumentation
 *
 * AbortController utilities.
 */

const abortControllerNever = new AbortController();

/**
 * An abort signal that never aborts.
 */
export const abortSignalNever = abortControllerNever.signal;

/**
 * An abort signal that aborts when any of the given abort signals abort.
 *
 * @param abortSignals - The abort signals to abort when any of them abort.
 * @returns The abort signal that aborts when any of the given abort signals abort.
 */
export function abortSignalAny(abortSignals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(abortSignals);
  }

  const abortController = new AbortController();

  for (const abortSignal of abortSignals) {
    abortSignal.addEventListener('abort', handleAbort, { once: true });
  }

  abortController.signal.addEventListener('abort', () => {
    for (const abortSignal of abortSignals) {
      abortSignal.removeEventListener('abort', handleAbort);
    }
  }, { once: true });

  return abortController.signal;

  function handleAbort(): void {
    abortController.abort();
  }
}
