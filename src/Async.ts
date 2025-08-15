/**
 * @packageDocumentation
 *
 * Contains utility functions for asynchronous operations.
 */

import type { Promisable } from 'type-fest';

import {
  abortSignalAny,
  abortSignalNever,
  abortSignalTimeout,
  waitForAbort
} from './AbortController.ts';
import { getLibDebugger } from './Debug.ts';
import {
  ASYNC_WRAPPER_ERROR_MESSAGE,
  CustomStackTraceError,
  emitAsyncErrorEvent,
  getStackTrace,
  printError
} from './Error.ts';
import { noop } from './Function.ts';

/**
 * A type representing a function that resolves a {@link Promise}.
 *
 * @typeParam T - The type of the value.
 */
export type PromiseResolve<T> = undefined extends T ? (value?: PromiseLike<T> | T) => void
  : (value: PromiseLike<T> | T) => void;

/**
 * Options for configuring the retry behavior.
 */
export interface RetryOptions {
  /**
   * The abort signal to cancel the retry operation.
   */
  abortSignal?: AbortSignal;

  /**
   * The delay in milliseconds between retry attempts.
   */
  retryDelayInMilliseconds?: number;

  /**
   * Whether to retry the function on error.
   */
  shouldRetryOnError?: boolean;

  /**
   * The maximum time in milliseconds to wait before giving up on retrying.
   */
  timeoutInMilliseconds?: number;
}

/**
 * Adds an error handler to a {@link Promise} that catches any errors and emits an async error event.
 *
 * @param asyncFn - The asynchronous function to add an error handler to.
 * @param stackTrace - The stack trace of the source function.
 * @returns A {@link Promise} that resolves when the asynchronous function completes or emits async error event.
 */
export async function addErrorHandler(asyncFn: () => Promise<unknown>, stackTrace?: string): Promise<void> {
  stackTrace ??= getStackTrace(1);
  try {
    await asyncFn();
  } catch (asyncError) {
    emitAsyncErrorEvent(new CustomStackTraceError(ASYNC_WRAPPER_ERROR_MESSAGE, stackTrace, asyncError));
  }
}

/**
 * Filters an array asynchronously, keeping only the elements that satisfy the provided predicate function.
 *
 * @typeParam T - The type of elements in the input array.
 * @param arr - The array to filter.
 * @param predicate - The predicate function to test each element.
 * @returns A {@link Promise} that resolves with an array of elements that satisfy the predicate function.
 */
export async function asyncFilter<T>(arr: T[], predicate: (value: T, index: number, array: T[]) => Promisable<boolean>): Promise<T[]> {
  const ans: T[] = [];

  const length = arr.length;
  for (let i = 0; i < length; i++) {
    if (!Object.hasOwn(arr, i)) {
      continue;
    }

    const item = arr[i] as T;
    if (await predicate(item, i, arr)) {
      ans.push(item);
    }
  }

  return ans;
}

/**
 * Filters an array asynchronously in place, keeping only the elements that satisfy the provided predicate function.
 *
 * @typeParam T - The type of elements in the input array.
 * @param arr - The array to filter.
 * @param predicate - The predicate function to test each element.
 * @returns A {@link Promise} that resolves when the array is filtered.
 */
export async function asyncFilterInPlace<T>(arr: T[], predicate: (value: T, index: number, array: T[]) => Promisable<boolean>): Promise<void> {
  const length = arr.length;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < length; readIndex++) {
    if (!Object.hasOwn(arr, readIndex)) {
      continue;
    }

    const current = arr[readIndex] as T;
    if (await predicate(current, readIndex, arr)) {
      // eslint-disable-next-line require-atomic-updates
      arr[writeIndex++] = current;
    }
  }
  arr.length = writeIndex;
}

/**
 * Maps over an array asynchronously, applying the provided callback function to each element, and then flattens the results into a single array.
 *
 * @typeParam T - The type of elements in the input array.
 * @typeParam U - The type of elements in the output array.
 * @param arr - The array to map over and flatten.
 * @param callback - The callback function to apply to each element.
 * @returns A {@link Promise} that resolves with a flattened array of the results of the callback function.
 */
export async function asyncFlatMap<T, U>(arr: T[], callback: (value: T, index: number, array: T[]) => Promisable<U[]>): Promise<U[]> {
  return (await asyncMap(arr, callback)).flat();
}

/**
 * Maps over an array asynchronously, applying the provided callback function to each element.
 *
 * @typeParam T - The type of elements in the input array.
 * @typeParam U - The type of elements in the output array.
 * @param arr - The array to map over.
 * @param callback - The callback function to apply to each element.
 * @returns A {@link Promise} that resolves with an array of the results of the callback function.
 */
export async function asyncMap<T, U>(arr: T[], callback: (value: T, index: number, array: T[]) => Promisable<U>): Promise<U[]> {
  return await promiseAllSequentially(arr.map(callback));
}

/**
 * Converts an asynchronous function to a synchronous one by automatically handling the Promise rejection.
 *
 * @typeParam Args - The types of the arguments the function accepts.
 * @param asyncFunc - The asynchronous function to convert.
 * @param stackTrace - The stack trace of the source function.
 * @returns A function that wraps the asynchronous function in a synchronous interface.
 */
export function convertAsyncToSync<Args extends unknown[]>(asyncFunc: (...args: Args) => Promise<unknown>, stackTrace?: string): (...args: Args) => void {
  stackTrace ??= getStackTrace(1);
  return (...args: Args): void => {
    const innerStackTrace = getStackTrace(1);
    stackTrace = `${stackTrace ?? ''}\n    at --- convertAsyncToSync --- (0)\n${innerStackTrace}`;
    invokeAsyncSafely(() => asyncFunc(...args), stackTrace);
  };
}

/**
 * Converts a synchronous function to an asynchronous one by wrapping it in a {@link Promise}.
 *
 * @typeParam Args - The types of the arguments the function accepts.
 * @typeParam Result - The type of the function's return value.
 * @param syncFn - The synchronous function to convert.
 * @returns A function that wraps the synchronous function in an asynchronous interface.
 */
export function convertSyncToAsync<Args extends unknown[], Result>(syncFn: (...args: Args) => Result): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    await Promise.resolve();
    return syncFn(...args);
  };
}

/**
 * Ignores an error that is thrown by an asynchronous function.
 *
 * @param promise - The promise to ignore the error of.
 * @param fallbackValue - Always `undefined`.
 * @returns A {@link Promise} that resolves when the asynchronous function completes or fails.
 */
export async function ignoreError(promise: Promise<unknown>, fallbackValue?: undefined): Promise<void>;

/**
 * Invokes an asynchronous function and returns a fallback value if an error is thrown.
 *
 * @typeParam T - The type of the value returned by the asynchronous function.
 * @param promise - The promise to ignore the error of.
 * @param fallbackValue - The value to return if an error is thrown.
 * @returns A {@link Promise} that resolves with the value returned by the asynchronous function or the fallback value if an error is thrown.
 */
export async function ignoreError<T>(promise: Promise<T>, fallbackValue: T): Promise<T> {
  const ignoreErrorDebugger = getLibDebugger('Async:ignoreError');
  const stackTrace = getStackTrace(1);
  try {
    return await promise;
  } catch (e) {
    ignoreErrorDebugger('Ignored error', new CustomStackTraceError('Ignored error', stackTrace, e));
    return fallbackValue;
  }
}

/**
 * Invokes a {@link Promise} and safely handles any errors by catching them and emitting an async error event.
 *
 * @param asyncFn - The asynchronous function to invoke safely.
 * @param stackTrace - The stack trace of the source function.
 */
export function invokeAsyncSafely(asyncFn: () => Promise<unknown>, stackTrace?: string): void {
  stackTrace ??= getStackTrace(1);
  // eslint-disable-next-line no-void
  void addErrorHandler(asyncFn, stackTrace);
}

/**
 * Invokes an asynchronous function after a delay.
 *
 * @param asyncFn - The asynchronous function to invoke.
 * @param delayInMilliseconds - The delay in milliseconds.
 * @param stackTrace - The stack trace of the source function.
 * @param abortSignal - The abort signal to listen to.
 */
export function invokeAsyncSafelyAfterDelay(
  asyncFn: (abortSignal: AbortSignal) => Promisable<void>,
  delayInMilliseconds = 0,
  stackTrace?: string,
  abortSignal?: AbortSignal
): void {
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();
  stackTrace ??= getStackTrace(1);
  invokeAsyncSafely(async () => {
    await sleep(delayInMilliseconds, abortSignal, true);
    await asyncFn(abortSignal);
  }, stackTrace);
}

/**
 * Executes async functions sequentially.
 *
 * @typeParam T - The type of the value.
 * @param asyncFns - The async functions to execute sequentially.
 * @returns A {@link Promise} that resolves with an array of the results of the async functions.
 */
export async function promiseAllAsyncFnsSequentially<T>(asyncFns: (() => Promisable<T>)[]): Promise<T[]> {
  const results: T[] = [];
  for (const asyncFn of asyncFns) {
    results.push(await asyncFn());
  }
  return results;
}

/**
 * Executes promises sequentially.
 *
 * @typeParam T - The type of the value.
 * @param promises - The promises to execute sequentially.
 * @returns A {@link Promise} that resolves with an array of the results of the promises.
 */
export async function promiseAllSequentially<T>(promises: Promisable<T>[]): Promise<T[]> {
  return await promiseAllAsyncFnsSequentially(promises.map((promise) => () => promise));
}

const terminateRetryErrors = new WeakSet<Error>();

class Result<R> {
  public constructor(public readonly result: R) {}
}

/**
 * Marks an error to terminate retry logic.
 *
 * @param error - The error to mark to terminate retry logic.
 */
export function marksAsTerminateRetry(error: Error): void {
  terminateRetryErrors.add(error);
}

/**
 * An async function that never ends.
 *
 * @returns A {@link Promise} that never resolves.
 */
export async function neverEnds(): Promise<never> {
  await new Promise(() => {
    noop();
  });
  throw new Error('Should never happen');
}

/**
 * Gets the next tick.
 *
 * @returns A promise that resolves when the next tick is available.
 */
export async function nextTickAsync(): Promise<void> {
  return new Promise((resolve) => {
    process.nextTick(() => {
      resolve();
    });
  });
}

/**
 * Gets the next queue microtask.
 *
 * @returns A promise that resolves when the next queue microtask is available.
 */
export async function queueMicrotaskAsync(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      resolve();
    });
  });
}

/**
 * Gets the next request animation frame.
 *
 * @returns A promise that resolves when the next request animation frame is available.
 */
export async function requestAnimationFrameAsync(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Retries the provided function until it returns true or the timeout is reached.
 *
 * @param fn - The function to retry.
 * @param retryOptions - Optional parameters to configure the retry behavior.
 * @param stackTrace - Optional stack trace.
 * @returns A {@link Promise} that resolves when the function returns true or rejects when the timeout is reached.
 */
export async function retryWithTimeout(fn: (abortSignal: AbortSignal) => Promisable<boolean>, retryOptions?: RetryOptions, stackTrace?: string): Promise<void> {
  const retryWithTimeoutDebugger = getLibDebugger('Async:retryWithTimeout');
  stackTrace ??= getStackTrace(1);
  const DEFAULT_RETRY_OPTIONS = {
    abortSignal: abortSignalNever(),
    // eslint-disable-next-line no-magic-numbers
    retryDelayInMilliseconds: 100,
    shouldRetryOnError: false,
    // eslint-disable-next-line no-magic-numbers
    timeoutInMilliseconds: 5000
  };
  const fullOptions = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  fullOptions.abortSignal.throwIfAborted();

  await runWithTimeout(
    fullOptions.timeoutInMilliseconds,
    async (abortSignal: AbortSignal) => {
      const combinedAbortSignal = abortSignalAny([fullOptions.abortSignal, abortSignal]);
      combinedAbortSignal.throwIfAborted();
      let attempt = 0;
      while (!combinedAbortSignal.aborted) {
        attempt++;
        let isSuccess: boolean;
        try {
          isSuccess = await fn(combinedAbortSignal);
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (combinedAbortSignal.aborted || !fullOptions.shouldRetryOnError || terminateRetryErrors.has(error as Error)) {
            throw new CustomStackTraceError('retryWithTimeout failed', stackTrace, error);
          }
          printError(error);
          isSuccess = false;
        }
        if (isSuccess) {
          retryWithTimeoutDebugger(`Retry completed successfully after ${String(attempt)} attempts`, {
            fn
          });
          retryWithTimeoutDebugger.printStackTrace(stackTrace);
          return;
        }

        retryWithTimeoutDebugger(
          `Retry attempt ${String(attempt)} completed unsuccessfully. Trying again in ${String(fullOptions.retryDelayInMilliseconds)} milliseconds`,
          {
            fn
          }
        );
        retryWithTimeoutDebugger.printStackTrace(stackTrace);
        await sleep(fullOptions.retryDelayInMilliseconds);
      }
    },
    { retryFn: fn },
    stackTrace
  );
}

/**
 * Executes a function with a timeout. If the function does not complete within the specified time, it is considered to have timed out.
 *
 * If `DEBUG=obsidian-dev-utils:Async:runWithTimeout` is set, the execution is not terminated after the timeout and the function is allowed to run indefinitely.
 *
 * @typeParam R - The type of the result from the asynchronous function.
 * @param timeoutInMilliseconds - The maximum time to wait in milliseconds.
 * @param fn - The function to execute.
 * @param context - The context of the function.
 * @param stackTrace - The stack trace of the source function.
 * @returns A {@link Promise} that resolves with the result of the asynchronous function or rejects if it times out.
 */
export async function runWithTimeout<R>(
  timeoutInMilliseconds: number,
  fn: (abortSignal: AbortSignal) => Promisable<R>,
  context?: unknown,
  stackTrace?: string
): Promise<R> {
  stackTrace ??= getStackTrace(1);
  const startTime = performance.now();

  const abortController = new AbortController();

  await Promise.race([run(), innerTimeout()]);
  if (abortController.signal.reason instanceof Result) {
    return abortController.signal.reason.result as R;
  }

  throw new CustomStackTraceError('Run with timeout failed', stackTrace, abortController.signal.reason as unknown);

  async function run(): Promise<void> {
    try {
      const result = await fn(abortController.signal);
      const duration = performance.now() - startTime;
      const runWithTimeoutDebugger = getLibDebugger('Async:runWithTimeout');
      runWithTimeoutDebugger(`Execution time: ${String(duration)} milliseconds`, { context, fn });
      runWithTimeoutDebugger.printStackTrace(stackTrace ?? '');
      abortController.abort(new Result(result));
    } catch (e) {
      abortController.abort(e);
    }
  }

  async function innerTimeout(): Promise<void> {
    while (!abortController.signal.aborted) {
      await sleep(timeoutInMilliseconds, abortController.signal);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (abortController.signal.aborted) {
        return;
      }
      const duration = performance.now() - startTime;
      console.warn(`Timed out after ${String(duration)} milliseconds`, { context, fn });
      const timeoutDebugger = getLibDebugger('Async:runWithTimeout:timeout');
      if (!timeoutDebugger.enabled) {
        abortController.abort(new Error(`Timed out after ${String(duration)} milliseconds`));
        return;
      }

      timeoutDebugger(
        `The execution is not terminated because debugger ${timeoutDebugger.namespace} is enabled. See https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md for more information`
      );
    }
  }
}

/**
 * Gets the next set immediate.
 *
 * @returns A promise that resolves when the next set immediate is available.
 */
export async function setImmediateAsync(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => {
      resolve();
    });
  });
}

/**
 * Delays execution for a specified number of milliseconds.
 *
 * @param delay - The time to wait in milliseconds.
 * @returns A {@link Promise} that resolves after the specified delay.
 */
export async function setTimeoutAsync(delay?: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

/**
 * Delays execution for a specified number of milliseconds.
 *
 * @param milliseconds - The time to wait in milliseconds.
 * @param abortSignal - The abort signal to listen to.
 * @param shouldThrowOnAbort - Whether to throw an error if the abort signal is aborted.
 * @returns A {@link Promise} that resolves after the specified delay.
 */
export async function sleep(milliseconds: number, abortSignal?: AbortSignal, shouldThrowOnAbort?: boolean): Promise<void> {
  await waitForAbort(abortSignalAny([abortSignal ?? abortSignalNever(), abortSignalTimeout(milliseconds)]));
  if (shouldThrowOnAbort) {
    abortSignal?.throwIfAborted();
  }
}

/**
 * Returns a {@link Promise} that rejects after the specified timeout period.
 *
 * @param timeoutInMilliseconds - The timeout period in milliseconds.
 * @param abortSignal - The abort signal to listen to.
 * @param shouldThrowOnAbort - Whether to throw an error if the abort signal is aborted.
 * @returns A {@link Promise} that always rejects with a timeout error.
 */
export async function timeout(timeoutInMilliseconds: number, abortSignal?: AbortSignal, shouldThrowOnAbort?: boolean): Promise<never> {
  await sleep(timeoutInMilliseconds, abortSignal, shouldThrowOnAbort);
  throw new Error(`Timed out in ${String(timeoutInMilliseconds)} milliseconds`);
}

/**
 * Converts an AsyncIterableIterator to an array by consuming all its elements.
 *
 * @typeParam T - The type of elements produced by the AsyncIterableIterator.
 * @param iter - The AsyncIterableIterator to convert.
 * @returns A {@link Promise} that resolves with an array of all the elements in the AsyncIterableIterator.
 */
export async function toArray<T>(iter: AsyncIterableIterator<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of iter) {
    arr.push(item);
  }
  return arr;
}
