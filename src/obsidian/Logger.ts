/**
 * @packageDocumentation Logger
 * Contains utility functions for logging in Obsidian.
 */

import type { MaybePromise } from '../Async.ts';

import { getStackTrace } from '../Error.ts';

/**
 * Invokes a function and logs the start, end, and duration of the invocation.
 *
 * @param title - The title of the log.
 * @param fn - The function to invoke.
 * @param stackTrace - Optional stack trace.
 */
export async function invokeAsyncAndLog(title: string, fn: () => MaybePromise<void>, stackTrace?: string): Promise<void> {
  const timestampStart = performance.now();
  if (stackTrace === undefined) {
    stackTrace = getStackTrace().split('\n').slice(1).join('\n');
  }
  console.debug(`${title}:start`, {
    fn,
    stackTrace,
    timestampStart
  });
  try {
    await fn();
    const timestampEnd = performance.now();
    console.debug(`${title}:end`, {
      duration: timestampEnd - timestampStart,
      timestampEnd,
      timestampStart
    });
  } catch (error) {
    const timestampEnd = performance.now();
    console.debug(`${title}:error`, {
      duration: timestampEnd - timestampStart,
      error,
      timestampEnd,
      timestampStart
    });

    throw error;
  }
}
