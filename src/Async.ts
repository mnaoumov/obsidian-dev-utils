import { showError } from "./Error.ts";

export type MaybePromise<T> = T | Promise<T>;

export type RetryOptions = {
  timeoutInMilliseconds: number;
  retryDelayInMilliseconds: number;
};

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

export async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runWithTimeout<R>(timeoutInMilliseconds: number, asyncFn: () => Promise<R>): Promise<R> {
  return await Promise.race([asyncFn(), timeout(timeoutInMilliseconds)]);
}

export async function timeout(timeoutInMilliseconds: number): Promise<never> {
  await sleep(timeoutInMilliseconds);
  throw new Error(`Timed out in ${timeoutInMilliseconds} milliseconds`);
}

export function invokeAsyncSafely(promise: Promise<unknown>): void {
  promise.catch(showError);
}

export function convertAsyncToSync<Args extends unknown[]>(asyncFunc: (...args: Args) => Promise<unknown>): (...args: Args) => void {
  return (...args: Args): void => invokeAsyncSafely(asyncFunc(...args));
}

export function convertSyncToAsync<Args extends unknown[], Result>(syncFn: (...args: Args) => Result): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    try {
      return syncFn(...args);
    } catch (error) {
      return await Promise.reject(error);
    }
  };
}

export async function asyncMap<T, U>(arr: T[], callback: (value: T, index: number, array: T[]) => MaybePromise<U>): Promise<U[]> {
  return await Promise.all(arr.map(callback));
}

export async function asyncFilter<T>(arr: T[], predicate: (value: T, index: number, array: T[]) => MaybePromise<boolean>): Promise<T[]> {
  const predicateResults = await asyncMap(arr, predicate);
  return arr.filter((_, index) => predicateResults[index]);
}

export async function asyncFlatMap<T, U>(arr: T[], callback: (value: T, index: number, array: T[]) => MaybePromise<U[]>): Promise<U[]> {
  return (await asyncMap(arr, callback)).flat();
}
