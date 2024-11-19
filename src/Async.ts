/**
 * @packageDocumentation Async
 * Contains utility functions for asynchronous operations.
 */

import {
  emitAsyncErrorEvent,
  getStackTrace,
  printError
} from './Error.ts';

/**
 * A type representing a value that can either be a direct value or a Promise resolving to that value.
 * @typeParam T - The type of the value.
 */
export type MaybePromise<T> = Promise<T> | T;

/**
 * Options for configuring the retry behavior.
 */
export interface RetryOptions {
  /**
   * The delay in milliseconds between retry attempts.
   */
  retryDelayInMilliseconds: number;

  /**
   * Whether to retry the function on error.
   */
  shouldRetryOnError: boolean;

  /**
   * The maximum time in milliseconds to wait before giving up on retrying.
   */
  timeoutInMilliseconds: number;
}

/**
 * Retries the provided function until it returns true or the timeout is reached.
 *
 * @param fn - The function to retry.
 * @param retryOptions - Optional parameters to configure the retry behavior.
 * @returns A Promise that resolves when the function returns true or rejects when the timeout is reached.
 */
export async function retryWithTimeout(fn: () => MaybePromise<boolean>, retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  const stackTrace = getStackTrace();
  const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    retryDelayInMilliseconds: 100,
    shouldRetryOnError: true,
    timeoutInMilliseconds: 5000
  };
  const overriddenOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  await runWithTimeout(overriddenOptions.timeoutInMilliseconds, async () => {
    let attempt = 0;
    for (; ;) {
      attempt++;
      let isSuccess: boolean;
      try {
        isSuccess = await fn();
      } catch (error) {
        if (!overriddenOptions.shouldRetryOnError || (error as Partial<TerminateRetry>).__terminateRetry) {
          throw error;
        }
        printError(error);
        isSuccess = false;
      }
      if (isSuccess) {
        if (attempt > 1) {
          console.debug(`Retry completed successfully after ${attempt.toString()} attempts`);
        }
        return;
      }

      console.debug(`Retry attempt ${attempt.toString()} completed unsuccessfully. Trying again in ${overriddenOptions.retryDelayInMilliseconds.toString()} milliseconds`, {
        fn,
        stackTrace
      });
      await sleep(overriddenOptions.retryDelayInMilliseconds);
    }
  });
}

/**
 * Delays execution for a specified number of milliseconds.
 *
 * @param milliseconds - The time to wait in milliseconds.
 * @returns A Promise that resolves after the specified delay.
 */
export async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Executes a function with a timeout. If the function does not complete within the specified time, it is considered to have timed out.
 *
 * @typeParam R - The type of the result from the asynchronous function.
 * @param timeoutInMilliseconds - The maximum time to wait in milliseconds.
 * @param fn - The function to execute.
 * @returns A Promise that resolves with the result of the asynchronous function or rejects if it times out.
 */
export async function runWithTimeout<R>(timeoutInMilliseconds: number, fn: () => MaybePromise<R>): Promise<R> {
  let timedOut = false;
  let result: R = null as R;

  await Promise.race([run(), timeout()]);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (timedOut) {
    console.error(`Timed out in ${timeoutInMilliseconds.toString()} milliseconds`, { fn });
    throw new Error('Timed out');
  }
  return result;

  async function run(): Promise<void> {
    result = await fn();
    timedOut = false;
  }

  async function timeout(): Promise<void> {
    await sleep(timeoutInMilliseconds);
    timedOut = true;
  }
}

/**
 * Returns a Promise that rejects after the specified timeout period.
 *
 * @param timeoutInMilliseconds - The timeout period in milliseconds.
 * @returns A Promise that always rejects with a timeout error.
 */
export async function timeout(timeoutInMilliseconds: number): Promise<never> {
  await sleep(timeoutInMilliseconds);
  throw new Error(`Timed out in ${timeoutInMilliseconds.toString()} milliseconds`);
}

/**
 * Invokes a Promise and safely handles any errors by catching them and emitting an async error event.
 *
 * @param asyncFn - The asynchronous function to invoke safely.
 */
export function invokeAsyncSafely(asyncFn: () => Promise<unknown>): void {
  void addErrorHandler(asyncFn);
}

/**
 * Adds an error handler to a Promise that catches any errors and emits an async error event.
 *
 * @param asyncFn - The asynchronous function to add an error handler to.
 * @returns A Promise that resolves when the asynchronous function completes or emits async error event.
 */
export async function addErrorHandler(asyncFn: () => Promise<unknown>): Promise<void> {
  try {
    await asyncFn();
  } catch (asyncError) {
    emitAsyncErrorEvent(asyncError);
  }
}

/**
 * Converts an asynchronous function to a synchronous one by automatically handling the Promise rejection.
 *
 * @typeParam Args - The types of the arguments the function accepts.
 * @param asyncFunc - The asynchronous function to convert.
 * @returns A function that wraps the asynchronous function in a synchronous interface.
 */
export function convertAsyncToSync<Args extends unknown[]>(asyncFunc: (...args: Args) => Promise<unknown>): (...args: Args) => void {
  return (...args: Args): void => {
    invokeAsyncSafely(() => asyncFunc(...args));
  };
}

/**
 * Converts a synchronous function to an asynchronous one by wrapping it in a Promise.
 *
 * @typeParam Args - The types of the arguments the function accepts.
 * @typeParam Result - The type of the function's return value.
 * @param syncFn - The synchronous function to convert.
 * @returns A function that wraps the synchronous function in an asynchronous interface.
 */
export function convertSyncToAsync<Args extends unknown[], Result>(syncFn: (...args: Args) => Result): (...args: Args) => Promise<Result> {
  return (...args: Args): Promise<Result> => Promise.resolve().then(() => syncFn(...args));
}

/**
 * Maps over an array asynchronously, applying the provided callback function to each element.
 *
 * @typeParam T - The type of elements in the input array.
 * @typeParam U - The type of elements in the output array.
 * @param arr - The array to map over.
 * @param callback - The callback function to apply to each element.
 * @returns A Promise that resolves with an array of the results of the callback function.
 */
export async function asyncMap<T, U>(arr: T[], callback: (value: T, index: number, array: T[]) => MaybePromise<U>): Promise<U[]> {
  return await Promise.all(arr.map(callback));
}

/**
 * Filters an array asynchronously, keeping only the elements that satisfy the provided predicate function.
 *
 * @typeParam T - The type of elements in the input array.
 * @param arr - The array to filter.
 * @param predicate - The predicate function to test each element.
 * @returns A Promise that resolves with an array of elements that satisfy the predicate function.
 */
export async function asyncFilter<T>(arr: T[], predicate: (value: T, index: number, array: T[]) => MaybePromise<boolean>): Promise<T[]> {
  const predicateResults = await asyncMap(arr, predicate);
  return arr.filter((_, index) => predicateResults[index]);
}

/**
 * Maps over an array asynchronously, applying the provided callback function to each element, and then flattens the results into a single array.
 *
 * @typeParam T - The type of elements in the input array.
 * @typeParam U - The type of elements in the output array.
 * @param arr - The array to map over and flatten.
 * @param callback - The callback function to apply to each element.
 * @returns A Promise that resolves with a flattened array of the results of the callback function.
 */
export async function asyncFlatMap<T, U>(arr: T[], callback: (value: T, index: number, array: T[]) => MaybePromise<U[]>): Promise<U[]> {
  return (await asyncMap(arr, callback)).flat();
}

/**
 * Converts an AsyncIterableIterator to an array by consuming all its elements.
 *
 * @typeParam T - The type of elements produced by the AsyncIterableIterator.
 * @param iter - The AsyncIterableIterator to convert.
 * @returns A Promise that resolves with an array of all the elements in the AsyncIterableIterator.
 */
export async function toArray<T>(iter: AsyncIterableIterator<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of iter) {
    arr.push(item);
  }
  return arr;
}

/**
 * A marker interface to indicate that an error should terminate retry logic.
 */
export interface TerminateRetry {
  /**
   * A marker property to indicate that an error should terminate retry logic.
   */
  __terminateRetry: true;
}

/**
 * Marks an error to terminate retry logic.
 *
 * @param error - The error to mark to terminate retry logic.
 * @returns An error that should terminate retry logic.
 */
export function marksAsTerminateRetry<TError extends Error>(error: TError): TerminateRetry & TError {
  return Object.assign(error, { __terminateRetry: true } as TerminateRetry);
}
