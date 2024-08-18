/**
 * @fileoverview Contains utility functions for asynchronous operations.
 */

import { emitAsyncErrorEvent } from "./Error.ts";

/**
 * A type representing a value that can either be a direct value or a Promise resolving to that value.
 * @template T The type of the value.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Options for configuring the retry behavior.
 */
export type RetryOptions = {
  /**
   * The maximum time in milliseconds to wait before giving up on retrying.
   */
  timeoutInMilliseconds: number;

  /**
   * The delay in milliseconds between retry attempts.
   */
  retryDelayInMilliseconds: number;
};

/**
 * Retries the provided asynchronous function until it succeeds or the timeout is reached.
 *
 * @param asyncFn - The asynchronous function to retry.
 * @param retryOptions - Optional parameters to configure the retry behavior.
 * @returns A Promise that resolves when the function succeeds or rejects when the timeout is reached.
 */
export async function retryWithTimeout(asyncFn: () => Promise<boolean>, retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    timeoutInMilliseconds: 5000,
    retryDelayInMilliseconds: 100
  };
  const overriddenOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  await runWithTimeout(overriddenOptions.timeoutInMilliseconds, async () => {
    let attempt = 0;
    while (true) {
      attempt++;
      if (await asyncFn()) {
        if (attempt > 1) {
          console.debug(`Retry completed successfully after ${attempt} attempts`);
        }
        return;
      }

      console.debug(`Retry attempt ${attempt} completed unsuccessfully. Trying again in ${overriddenOptions.retryDelayInMilliseconds} milliseconds`);
      console.debug(asyncFn);
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
 * Executes an asynchronous function with a timeout. If the function does not complete within the specified time, it is considered to have timed out.
 *
 * @template R The type of the result from the asynchronous function.
 * @param timeoutInMilliseconds - The maximum time to wait in milliseconds.
 * @param asyncFn - The asynchronous function to execute.
 * @returns A Promise that resolves with the result of the asynchronous function or rejects if it times out.
 */
export async function runWithTimeout<R>(timeoutInMilliseconds: number, asyncFn: () => Promise<R>): Promise<R> {
  return await Promise.race([asyncFn(), timeout(timeoutInMilliseconds)]);
}

/**
 * Returns a Promise that rejects after the specified timeout period.
 *
 * @param timeoutInMilliseconds - The timeout period in milliseconds.
 * @returns A Promise that always rejects with a timeout error.
 */
export async function timeout(timeoutInMilliseconds: number): Promise<never> {
  await sleep(timeoutInMilliseconds);
  throw new Error(`Timed out in ${timeoutInMilliseconds} milliseconds`);
}

/**
 * Invokes a Promise and safely handles any errors by catching them and emitting an async error event.
 *
 * @param promise - The Promise to invoke.
 */
export function invokeAsyncSafely(promise: Promise<unknown>): void {
  promise.catch(emitAsyncErrorEvent);
}

/**
 * Converts an asynchronous function to a synchronous one by automatically handling the Promise rejection.
 *
 * @template Args The types of the arguments the function accepts.
 * @param asyncFunc - The asynchronous function to convert.
 * @returns A function that wraps the asynchronous function in a synchronous interface.
 */
export function convertAsyncToSync<Args extends unknown[]>(asyncFunc: (...args: Args) => Promise<unknown>): (...args: Args) => void {
  return (...args: Args): void => invokeAsyncSafely(asyncFunc(...args));
}

/**
 * Converts a synchronous function to an asynchronous one by wrapping it in a Promise.
 *
 * @template Args The types of the arguments the function accepts.
 * @template Result The type of the function's return value.
 * @param syncFn - The synchronous function to convert.
 * @returns A function that wraps the synchronous function in an asynchronous interface.
 */
export function convertSyncToAsync<Args extends unknown[], Result>(syncFn: (...args: Args) => Result): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    try {
      return syncFn(...args);
    } catch (error) {
      return await Promise.reject(error);
    }
  };
}

/**
 * Maps over an array asynchronously, applying the provided callback function to each element.
 *
 * @template T The type of elements in the input array.
 * @template U The type of elements in the output array.
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
 * @template T The type of elements in the input array.
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
 * @template T The type of elements in the input array.
 * @template U The type of elements in the output array.
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
 * @template T The type of elements produced by the AsyncIterableIterator.
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
