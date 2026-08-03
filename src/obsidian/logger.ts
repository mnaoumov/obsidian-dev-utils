/**
 * @file
 *
 * Contains utility functions for logging in Obsidian.
 */

import type { Promisable } from 'type-fest';

import { abortSignalNever } from '../abort-controller.ts';
import {
  getLibDebugger,
  printWithStackTrace
} from '../debug.ts';
import { getStackTrace } from '../error.ts';

/**
 * Parameters for {@link invokeAsyncAndLog}.
 */
export interface InvokeAsyncAndLogParams {
  /**
   * The function to invoke.
   *
   * @param abortSignal - The abort signal to control the execution of the function.
   * @returns A {@link Promisable} that resolves when the function is complete.
   */
  $function(this: void, abortSignal: AbortSignal): Promisable<void>;

  /**
   * The abort signal to control the execution of the function.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * Optional stack trace.
   */
  readonly stackTrace?: string;

  /**
   * The title of the log.
   */
  readonly title: string;
}

/**
 * Invokes a function and logs the start, end, and duration of the invocation.
 *
 * @param params - The parameters for the invocation.
 */
export async function invokeAsyncAndLog(params: InvokeAsyncAndLogParams): Promise<void> {
  const {
    $function,
    abortSignal = abortSignalNever(),
    title
  } = params;
  abortSignal.throwIfAborted();
  const invokeAsyncAndLogDebugger = getLibDebugger('Logger:invokeAsyncAndLog');
  const timestampStart = performance.now();
  const stackTrace = params.stackTrace ?? getStackTrace(1);
  printWithStackTrace({
    $arguments: [{
      $function,
      timestampStart
    }],
    debuggerInstance: invokeAsyncAndLogDebugger,
    message: `${title}:start`,
    stackTrace
  });
  try {
    await $function(abortSignal);
    const timestampEnd = performance.now();
    const duration = Math.trunc(timestampEnd - timestampStart);
    if (abortSignal.aborted) {
      printWithStackTrace({
        $arguments: [{
          $function,
          abortReason: abortSignal.reason as unknown,
          duration,
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
      $arguments: [{
        $function,
        duration,
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
      $arguments: [{
        $function,
        duration: Math.trunc(timestampEnd - timestampStart),
        error,
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
