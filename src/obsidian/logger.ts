/**
 * @file
 *
 * Contains utility functions for logging in Obsidian.
 */

import type { Promisable } from 'type-fest';

import {
  getLibDebugger,
  printWithStackTrace
} from '../debug.ts';
import { getStackTrace } from '../error.ts';

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
  printWithStackTrace({
    args: [{
      fn,
      timestampStart
    }],
    debuggerInstance: invokeAsyncAndLogDebugger,
    message: `${title}:start`,
    stackTrace
  });
  try {
    await fn(abortSignal);
    const timestampEnd = performance.now();
    const duration = Math.trunc(timestampEnd - timestampStart);
    if (abortSignal.aborted) {
      printWithStackTrace({
        args: [{
          abortReason: abortSignal.reason as unknown,
          duration,
          fn,
          timestampEnd,
          timestampStart
        }],
        debuggerInstance: invokeAsyncAndLogDebugger,
        message: `${title}:aborted`,
        stackTrace
      });
      abortSignal.throwIfAborted();
    }
    printWithStackTrace({
      args: [{
        duration,
        fn,
        timestampEnd,
        timestampStart
      }],
      debuggerInstance: invokeAsyncAndLogDebugger,
      message: `${title}:end`,
      stackTrace
    });
  } catch (error) {
    const timestampEnd = performance.now();
    printWithStackTrace({
      args: [{
        duration: Math.trunc(timestampEnd - timestampStart),
        error,
        fn,
        timestampEnd,
        timestampStart
      }],
      debuggerInstance: invokeAsyncAndLogDebugger,
      message: `${title}:error`,
      stackTrace
    });
    throw error;
  }
}
