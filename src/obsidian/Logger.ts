/**
 * @packageDocumentation Logger
 * Contains utility functions for logging in Obsidian.
 */

import type { MaybePromise } from '../Async.ts';

import { getDebugger } from '../Debug.ts';
import { getStackTrace } from '../Error.ts';

const invokeAsyncAndLogDebugger = getDebugger('obsidian-dev-utils:Logger:invokeAsyncAndLog');

/**
 * Invokes a function and logs the start, end, and duration of the invocation.
 *
 * @param title - The title of the log.
 * @param fn - The function to invoke.
 * @param stackTrace - Optional stack trace.
 */
export async function invokeAsyncAndLog(title: string, fn: () => MaybePromise<void>, stackTrace?: string): Promise<void> {
  const timestampStart = performance.now();
  stackTrace ??= getStackTrace(1);
  invokeAsyncAndLogDebugger(`${title}:start`, {
    fn,
    timestampStart
  });
  invokeAsyncAndLogDebugger.printStackTrace(stackTrace);
  try {
    await fn();
    const timestampEnd = performance.now();
    invokeAsyncAndLogDebugger(`${title}:end`, {
      duration: timestampEnd - timestampStart,
      fn,
      timestampEnd,
      timestampStart
    });
    invokeAsyncAndLogDebugger.printStackTrace(stackTrace);
  } catch (error) {
    const timestampEnd = performance.now();
    invokeAsyncAndLogDebugger(`${title}:error`, {
      duration: timestampEnd - timestampStart,
      error,
      fn,
      timestampEnd,
      timestampStart
    });
    invokeAsyncAndLogDebugger.printStackTrace(stackTrace);

    throw error;
  }
}
