/**
 * @packageDocumentation
 *
 * Contains utility functions for logging in Obsidian.
 */

import type { Promisable } from 'type-fest';

import {
  getLibDebugger,
  printWithStackTrace
} from '../Debug.ts';
import { getStackTrace } from '../Error.ts';

/**
 * Invokes a function and logs the start, end, and duration of the invocation.
 *
 * @param title - The title of the log.
 * @param fn - The function to invoke.
 * @param abortSignal - The abort signal to control the execution of the function.
 * @param stackTrace - Optional stack trace.
 */
export async function invokeAsyncAndLog(
  title: string,
  fn: (abortSignal: AbortSignal) => Promisable<void>,
  abortSignal: AbortSignal,
  stackTrace?: string
): Promise<void> {
  abortSignal.throwIfAborted();
  const invokeAsyncAndLogDebugger = getLibDebugger('Logger:invokeAsyncAndLog');
  const timestampStart = performance.now();
  stackTrace ??= getStackTrace(1);
  printWithStackTrace(invokeAsyncAndLogDebugger, stackTrace, `${title}:start`, {
    fn,
    timestampStart
  });
  try {
    await fn(abortSignal);
    const timestampEnd = performance.now();
    const duration = timestampEnd - timestampStart;
    if (abortSignal.aborted) {
      printWithStackTrace(invokeAsyncAndLogDebugger, stackTrace, `${title}:aborted`, {
        abortReason: abortSignal.reason as unknown,
        duration,
        fn,
        timestampEnd,
        timestampStart
      });
      abortSignal.throwIfAborted();
    }
    printWithStackTrace(invokeAsyncAndLogDebugger, stackTrace, `${title}:end`, {
      duration,
      fn,
      timestampEnd,
      timestampStart
    });
  } catch (error) {
    const timestampEnd = performance.now();
    printWithStackTrace(invokeAsyncAndLogDebugger, stackTrace, `${title}:error`, {
      duration: timestampEnd - timestampStart,
      error,
      fn,
      timestampEnd,
      timestampStart
    });
    throw error;
  }
}
