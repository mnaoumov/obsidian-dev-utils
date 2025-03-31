/**
 * @packageDocumentation Logger
 * Contains utility functions for logging in Obsidian.
 */

import type { Promisable } from 'type-fest';

import { getLibDebugger } from '../Debug.ts';
import { getStackTrace } from '../Error.ts';
/**
 * Invokes a function and logs the start, end, and duration of the invocation.
 *
 * @param title - The title of the log.
 * @param fn - The function to invoke.
 * @param stackTrace - Optional stack trace.
 */
export async function invokeAsyncAndLog(title: string, fn: () => Promisable<void>, stackTrace?: string): Promise<void> {
  const _debugger = getLibDebugger('Logger:invokeAsyncAndLog');
  const timestampStart = performance.now();
  stackTrace ??= getStackTrace(1);
  _debugger(`${title}:start`, {
    fn,
    timestampStart
  });
  _debugger.printStackTrace(stackTrace);
  try {
    await fn();
    const timestampEnd = performance.now();
    _debugger(`${title}:end`, {
      duration: timestampEnd - timestampStart,
      fn,
      timestampEnd,
      timestampStart
    });
    _debugger.printStackTrace(stackTrace);
  } catch (error) {
    const timestampEnd = performance.now();
    _debugger(`${title}:error`, {
      duration: timestampEnd - timestampStart,
      error,
      fn,
      timestampEnd,
      timestampStart
    });
    _debugger.printStackTrace(stackTrace);

    throw error;
  }
}
