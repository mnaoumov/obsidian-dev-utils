import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { TimeoutContext } from './async.ts';

import {
  addErrorHandler,
  asyncFilter,
  asyncFilterInPlace,
  asyncFlatMap,
  asyncMap,
  convertAsyncToSync,
  convertSyncToAsync,
  handleSilentError,
  ignoreError,
  invokeAsyncSafely,
  invokeAsyncSafelyAfterDelay,
  marksAsTerminateRetry,
  neverEnds,
  nextTickAsync,
  promiseAllAsyncFnsSequentially,
  promiseAllSequentially,
  queueMicrotaskAsync,
  retryWithTimeout,
  runWithTimeout,
  setImmediateAsync,
  setTimeoutAsync,
  sleep,
  timeout,
  toArray
} from './async.ts';
import {
  registerAsyncErrorEventHandler,
  SilentError
} from './error.ts';
import {
  noop,
  noopAsync
} from './function.ts';
import { assertNonNullable } from './type-guards.ts';

describe('Async', () => {
  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not resolve before the specified delay', async () => {
      const callback = vi.fn();
      sleep(1000).then(callback).catch(noop);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should resolve after the specified delay', async () => {
      const callback = vi.fn();
      const promise = sleep(1000).then(callback);
      await vi.advanceTimersByTimeAsync(1000);
      await promise;
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should resolve immediately for 0ms delay', async () => {
      const callback = vi.fn();
      const promise = sleep(0).then(callback);
      await vi.advanceTimersByTimeAsync(0);
      await promise;
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe('asyncFilter', () => {
    it('should filter elements based on async predicate', async () => {
      const result = await asyncFilter([1, 2, 3, 4, 5], async (v) => {
        await Promise.resolve();
        return v % 2 === 0;
      });
      expect(result).toEqual([2, 4]);
    });

    it('should filter elements based on sync predicate', async () => {
      const result = await asyncFilter([10, 20, 30], (v) => v > 15);
      expect(result).toEqual([20, 30]);
    });

    it('should return an empty array when nothing matches', async () => {
      const result = await asyncFilter([1, 2, 3], async () => false);
      expect(result).toEqual([]);
    });

    it('should return all elements when everything matches', async () => {
      const result = await asyncFilter([1, 2, 3], async () => true);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle an empty array', async () => {
      const result = await asyncFilter([], async () => true);
      expect(result).toEqual([]);
    });

    it('should call predicate the correct number of times', async () => {
      const predicate = vi.fn(async () => true);
      const arr = ['a', 'b', 'c'];
      await asyncFilter(arr, predicate);
      expect(predicate).toHaveBeenCalledTimes(3);
    });

    it.each([
      [1, 'a', 0],
      [2, 'b', 1],
      [3, 'c', 2]
    ])('should pass correct arguments to predicate on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const predicate = vi.fn(async () => true);
      const arr = ['a', 'b', 'c'];
      await asyncFilter(arr, predicate);
      expect(predicate).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, arr);
    });

    it('should not mutate the original array', async () => {
      const original = [1, 2, 3, 4];
      await asyncFilter(original, async (v) => v > 2);
      expect(original).toEqual([1, 2, 3, 4]);
    });

    it('should return only matching elements from the original array', async () => {
      const original = [1, 2, 3, 4];
      const result = await asyncFilter(original, async (v) => v > 2);
      expect(result).toEqual([3, 4]);
    });

    it('should skip sparse array holes', async () => {
      const arr = new Array<number>(5);
      arr[1] = 10;
      arr[3] = 30;
      const result = await asyncFilter(arr, async () => true);
      expect(result).toEqual([10, 30]);
    });
  });

  describe('asyncFilterInPlace', () => {
    it('should filter elements in place based on async predicate', async () => {
      const arr = [1, 2, 3, 4, 5];
      await asyncFilterInPlace(arr, async (v) => v % 2 !== 0);
      expect(arr).toEqual([1, 3, 5]);
    });

    it('should handle an empty array', async () => {
      const arr: number[] = [];
      await asyncFilterInPlace(arr, async () => true);
      expect(arr).toEqual([]);
    });

    it('should remove all elements when predicate always returns false', async () => {
      const arr = [1, 2, 3];
      await asyncFilterInPlace(arr, async () => false);
      expect(arr).toEqual([]);
    });

    it('should set length to 0 when predicate always returns false', async () => {
      const arr = [1, 2, 3];
      await asyncFilterInPlace(arr, async () => false);
      expect(arr.length).toBe(0);
    });

    it('should keep all elements when predicate always returns true', async () => {
      const arr = [1, 2, 3];
      await asyncFilterInPlace(arr, async () => true);
      expect(arr).toEqual([1, 2, 3]);
    });

    it('should update array content correctly after filtering', async () => {
      const arr = [10, 20, 30, 40, 50];
      await asyncFilterInPlace(arr, async (v) => v >= 30);
      expect(arr).toEqual([30, 40, 50]);
    });

    it('should update array length correctly after filtering', async () => {
      const arr = [10, 20, 30, 40, 50];
      await asyncFilterInPlace(arr, async (v) => v >= 30);
      expect(arr.length).toBe(3);
    });

    it('should skip sparse array holes and keep only defined elements', async () => {
      const arr = new Array<number>(5);
      arr[1] = 10;
      arr[3] = 30;
      await asyncFilterInPlace(arr, async () => true);
      expect(arr).toEqual([10, 30]);
    });

    it('should update length correctly after filtering sparse arrays', async () => {
      const arr = new Array<number>(5);
      arr[1] = 10;
      arr[3] = 30;
      await asyncFilterInPlace(arr, async () => true);
      expect(arr.length).toBe(2);
    });
  });

  describe('asyncMap', () => {
    it('should map elements with async callback', async () => {
      const result = await asyncMap([1, 2, 3], async (v) => {
        await Promise.resolve();
        return v * 2;
      });
      expect(result).toEqual([2, 4, 6]);
    });

    it('should map elements with sync callback', async () => {
      const result = await asyncMap([1, 2, 3], (v) => v.toString());
      expect(result).toEqual(['1', '2', '3']);
    });

    it('should handle an empty array', async () => {
      const result = await asyncMap([], async (v: number) => v * 2);
      expect(result).toEqual([]);
    });

    it('should not mutate the original array', async () => {
      const original = [1, 2, 3];
      await asyncMap(original, async (v) => v + 10);
      expect(original).toEqual([1, 2, 3]);
    });

    it('should return the mapped results', async () => {
      const original = [1, 2, 3];
      const result = await asyncMap(original, async (v) => v + 10);
      expect(result).toEqual([11, 12, 13]);
    });
  });

  describe('asyncFlatMap', () => {
    it('should map and flatten results', async () => {
      const result = await asyncFlatMap([1, 2, 3], async (v) => {
        await Promise.resolve();
        return [v, v * 10];
      });
      expect(result).toEqual([1, 10, 2, 20, 3, 30]);
    });

    it('should handle callbacks that return empty arrays', async () => {
      const result = await asyncFlatMap([1, 2, 3], async () => []);
      expect(result).toEqual([]);
    });

    it('should handle an empty input array', async () => {
      const result = await asyncFlatMap([], async (v: number) => [v]);
      expect(result).toEqual([]);
    });

    it('should flatten only one level', async () => {
      const result = await asyncFlatMap([1], async () => [[1, 2], [3, 4]]);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('convertSyncToAsync', () => {
    it('should wrap a sync function into an async one', async () => {
      function syncFn(a: number, b: number): number {
        return a + b;
      }
      const asyncFn = convertSyncToAsync(syncFn);
      const result = await asyncFn(3, 4);
      expect(result).toBe(7);
    });

    it('should return a promise', () => {
      function syncFn(): string {
        return 'hello';
      }
      const asyncFn = convertSyncToAsync(syncFn);
      const result = asyncFn();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should propagate thrown errors as rejected promises', async () => {
      function syncFn(): never {
        throw new Error('sync boom');
      }
      const asyncFn = convertSyncToAsync(syncFn);
      await expect(asyncFn()).rejects.toThrow('sync boom');
    });

    it('should pass arguments correctly', async () => {
      const syncFn = vi.fn((x: string) => x.toUpperCase());
      const asyncFn = convertSyncToAsync(syncFn);
      await asyncFn('test');
      expect(syncFn).toHaveBeenCalledWith('test');
    });
  });

  describe('promiseAllSequentially', () => {
    it('should resolve all promises in order', async () => {
      const result = await promiseAllSequentially([
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3)
      ]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle plain values alongside promises', async () => {
      const result = await promiseAllSequentially([1, Promise.resolve(2), 3]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle an empty array', async () => {
      const result = await promiseAllSequentially([]);
      expect(result).toEqual([]);
    });

    it('should reject if any promise rejects', async () => {
      await expect(
        promiseAllSequentially([
          Promise.resolve(1),
          Promise.reject(new Error('fail')),
          Promise.resolve(3)
        ])
      ).rejects.toThrow('fail');
    });
  });

  describe('promiseAllAsyncFnsSequentially', () => {
    it('should collect results from sequential async functions', async () => {
      const order: number[] = [];
      const result = await promiseAllAsyncFnsSequentially([
        async (): Promise<string> => {
          order.push(1);
          return 'a';
        },
        async (): Promise<string> => {
          order.push(2);
          return 'b';
        },
        async (): Promise<string> => {
          order.push(3);
          return 'c';
        }
      ]);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should execute async functions in sequential order', async () => {
      const order: number[] = [];
      await promiseAllAsyncFnsSequentially([
        async (): Promise<string> => {
          order.push(1);
          return 'a';
        },
        async (): Promise<string> => {
          order.push(2);
          return 'b';
        },
        async (): Promise<string> => {
          order.push(3);
          return 'c';
        }
      ]);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle sync functions', async () => {
      const result = await promiseAllAsyncFnsSequentially([
        (): number => 10,
        (): number => 20,
        (): number => 30
      ]);
      expect(result).toEqual([10, 20, 30]);
    });

    it('should handle an empty array', async () => {
      const result = await promiseAllAsyncFnsSequentially([]);
      expect(result).toEqual([]);
    });

    it('should stop execution on first error', async () => {
      const fn3 = vi.fn(async (): Promise<string> => 'c');
      await expect(
        promiseAllAsyncFnsSequentially([
          async (): Promise<string> => 'a',
          async (): Promise<never> => {
            throw new Error('seq fail');
          },
          fn3
        ])
      ).rejects.toThrow('seq fail');
      expect(fn3).not.toHaveBeenCalled();
    });

    it('should execute functions one at a time, not in parallel', async () => {
      let concurrency = 0;
      let maxConcurrency = 0;
      async function fn(): Promise<void> {
        concurrency++;
        maxConcurrency = Math.max(maxConcurrency, concurrency);
        await Promise.resolve();
        concurrency--;
      }
      await promiseAllAsyncFnsSequentially([fn, fn, fn]);
      expect(maxConcurrency).toBe(1);
    });
  });

  describe('ignoreError', () => {
    it('should return the resolved value when promise succeeds', async () => {
      const result = await ignoreError(Promise.resolve(42), 42);
      expect(result).toBe(42);
    });

    it('should return undefined when promise rejects and no fallback given', async () => {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Need to test `void` as `undefined`.
      const result = await ignoreError(Promise.reject(new Error('ignored')));
      expect(result).toBeUndefined();
    });

    it('should return fallback value when promise rejects', async () => {
      const result = await ignoreError(Promise.reject(new Error('fail')), 'fallback');
      expect(result).toBe('fallback');
    });

    it('should not throw when promise rejects', async () => {
      await expect(ignoreError(Promise.reject(new Error('boom')))).resolves.toBeUndefined();
    });
  });

  describe('toArray', () => {
    it('should convert an async iterable to an array', async () => {
      async function* gen(): AsyncGenerator<number, void> {
        yield 1;
        yield 2;
        yield 3;
      }
      const result = await toArray(gen());
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle an empty async iterable', async () => {
      async function* gen(): AsyncGenerator<never, void> {
        // Yields nothing
      }
      const result = await toArray(gen());
      expect(result).toEqual([]);
    });

    it('should handle a single-element async iterable', async () => {
      async function* gen(): AsyncGenerator<string, void> {
        yield 'only';
      }
      const result = await toArray(gen());
      expect(result).toEqual(['only']);
    });

    it('should preserve element order', async () => {
      async function* gen(): AsyncGenerator<string, void> {
        yield 'a';
        yield 'b';
        yield 'c';
        yield 'd';
      }
      const result = await toArray(gen());
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('handleSilentError', () => {
    it('should return true for a SilentError', () => {
      const error = new SilentError('quiet');
      expect(handleSilentError(error)).toBe(true);
    });

    it('should return true for an Error wrapping a SilentError', () => {
      const silent = new SilentError('quiet');
      const wrapper = new Error('wrapper', { cause: silent });
      expect(handleSilentError(wrapper)).toBe(true);
    });

    it('should return true for deeply nested SilentError cause', () => {
      const silent = new SilentError('quiet');
      const mid = new Error('mid', { cause: silent });
      const outer = new Error('outer', { cause: mid });
      expect(handleSilentError(outer)).toBe(true);
    });

    it('should return false for a regular Error', () => {
      const error = new Error('not silent');
      expect(handleSilentError(error)).toBe(false);
    });

    it.each([
      ['string', 'string'],
      ['number', 42],
      ['null', null],
      ['undefined', undefined]
    ])('should return false for a non-Error value (%s)', (_label, value) => {
      expect(handleSilentError(value)).toBe(false);
    });

    it('should return false for an Error chain without SilentError', () => {
      const inner = new Error('inner');
      const outer = new Error('outer', { cause: inner });
      expect(handleSilentError(outer)).toBe(false);
    });

    it('should return false for Error with non-Error cause', () => {
      const error = new Error('outer', { cause: 'string cause' });
      expect(handleSilentError(error)).toBe(false);
    });
  });

  describe('marksAsTerminateRetry', () => {
    it('should mark an error for retry termination', () => {
      // MarksAsTerminateRetry is tested indirectly through retryWithTimeout
      // But we can verify it does not throw
      const error = new Error('test');
      expect(() => {
        marksAsTerminateRetry(error);
      }).not.toThrow();
    });
  });

  describe('runWithTimeout', () => {
    it('should return the result when operation completes within timeout', async () => {
      const result = await runWithTimeout({
        operationFn: async () => 42,
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe(42);
    });

    it('should return the result for synchronous operationFn', async () => {
      const result = await runWithTimeout({
        operationFn: () => 'sync result',
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe('sync result');
    });

    it('should throw when operation times out with default onTimeout', async () => {
      await expect(runWithTimeout({
        operationFn: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 10000);
          });
          return 'late';
        },
        timeoutInMilliseconds: 50
      })).rejects.toThrow('Run with timeout failed');
    });

    it('should throw when operationFn throws an error', async () => {
      await expect(runWithTimeout({
        operationFn: async () => {
          throw new Error('operation failed');
        },
        timeoutInMilliseconds: 5000
      })).rejects.toThrow('Run with timeout failed');
    });

    it('should reject when custom onTimeout handler terminates the operation', async () => {
      const onTimeout = vi.fn((ctx: TimeoutContext): void => {
        ctx.terminateOperation();
      });

      await expect(runWithTimeout({
        onTimeout,
        operationFn: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 10000);
          });
          return 'late';
        },
        timeoutInMilliseconds: 50
      })).rejects.toThrow();
    });

    it('should call custom onTimeout handler when timeout occurs', async () => {
      const onTimeout = vi.fn((ctx: TimeoutContext): void => {
        ctx.terminateOperation();
      });

      try {
        await runWithTimeout({
          onTimeout,
          operationFn: async () => {
            await new Promise((resolve) => {
              setTimeout(resolve, 10000);
            });
            return 'late';
          },
          timeoutInMilliseconds: 50
        });
      } catch {
        // Expected
      }

      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should pass correct TimeoutContext to custom onTimeout handler', async () => {
      const onTimeout = vi.fn((ctx: TimeoutContext): void => {
        ctx.terminateOperation();
      });

      try {
        await runWithTimeout({
          onTimeout,
          operationFn: async () => {
            await new Promise((resolve) => {
              setTimeout(resolve, 10000);
            });
            return 'late';
          },
          timeoutInMilliseconds: 50
        });
      } catch {
        // Expected
      }

      expect(onTimeout).toHaveBeenCalledWith(expect.objectContaining({
        duration: expect.any(Number) as number,
        onOperationCompleted: expect.any(Function) as () => void,
        operationName: expect.any(String) as string,
        terminateOperation: expect.any(Function) as () => void
      }));
    });

    it('should provide TimeoutContext with correct operationName', async () => {
      let capturedCtx: null | TimeoutContext = null;

      try {
        await runWithTimeout({
          onTimeout(ctx) {
            capturedCtx = ctx;
            ctx.terminateOperation();
          },
          operationFn: async () => {
            await new Promise((resolve) => {
              setTimeout(resolve, 10000);
            });
          },
          operationName: 'myOperation',
          timeoutInMilliseconds: 50
        });
      } catch {
        // Expected
      }

      expect(capturedCtx).not.toBeNull();
    });

    it('should set operationName on the captured TimeoutContext', async () => {
      let capturedCtx: null | TimeoutContext = null;

      try {
        await runWithTimeout({
          onTimeout(ctx) {
            capturedCtx = ctx;
            ctx.terminateOperation();
          },
          operationFn: async () => {
            await new Promise((resolve) => {
              setTimeout(resolve, 10000);
            });
          },
          operationName: 'myOperation',
          timeoutInMilliseconds: 50
        });
      } catch {
        // Expected
      }

      assertNonNullable(capturedCtx);
      expect((capturedCtx as { operationName: string }).operationName).toBe('myOperation');
    });

    it('should return the result when onTimeout does not terminate', async () => {
      const result = await runWithTimeout({
        onTimeout(ctx) {
          ctx.onOperationCompleted(() => {
            // Do not terminate - let the operation finish on its own
          });
        },
        async operationFn() {
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
          return 'finished';
        },
        timeoutInMilliseconds: 10
      });

      expect(result).toBe('finished');
    });

    it('should call onOperationCompleted callback when operation finishes after timeout', async () => {
      let completedCallbackCalled = false;

      await runWithTimeout({
        onTimeout(ctx) {
          ctx.onOperationCompleted(() => {
            completedCallbackCalled = true;
          });
        },
        async operationFn() {
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
          return 'finished';
        },
        timeoutInMilliseconds: 10
      });

      expect(completedCallbackCalled).toBe(true);
    });

    it('should pass abortSignal to operationFn', async () => {
      let receivedSignal: AbortSignal | null = null;

      await runWithTimeout({
        operationFn(abortSignal) {
          receivedSignal = abortSignal;
          return 'done';
        },
        timeoutInMilliseconds: 5000
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should abort the signal when operation times out', async () => {
      let receivedSignal: AbortSignal | null = null;

      try {
        await runWithTimeout({
          operationFn: async (abortSignal) => {
            receivedSignal = abortSignal;
            await new Promise((resolve) => {
              setTimeout(resolve, 10000);
            });
            return 'late';
          },
          timeoutInMilliseconds: 50
        });
      } catch {
        // Expected
      }

      assertNonNullable(receivedSignal);
      expect((receivedSignal as AbortSignal).aborted).toBe(true);
    });
  });

  describe('retryWithTimeout', () => {
    it('should resolve when operationFn returns true on first attempt', async () => {
      const fn = vi.fn(async () => true);

      await retryWithTimeout({
        operationFn: fn,
        retryOptions: { timeoutInMilliseconds: 5000 }
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry until operationFn returns true', async () => {
      let attempt = 0;
      const fn = vi.fn(async () => {
        attempt++;
        return attempt >= 3;
      });

      await retryWithTimeout({
        operationFn: fn,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 5000
        }
      });

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should resolve when timeout is reached and the while loop exits due to abort', async () => {
      const fn = vi.fn(async () => false);

      await expect(retryWithTimeout({
        operationFn: fn,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      })).resolves.toBeUndefined();
    });

    it('should have called operationFn at least once before timeout', async () => {
      const fn = vi.fn(async () => false);

      await retryWithTimeout({
        operationFn: fn,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      });

      expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw immediately if abortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(new Error('already aborted'));

      await expect(retryWithTimeout({
        operationFn: async () => true,
        retryOptions: {
          abortSignal: controller.signal,
          timeoutInMilliseconds: 5000
        }
      })).rejects.toThrow();
    });

    it('should pass an AbortSignal instance to operationFn', async () => {
      let receivedSignal: AbortSignal | null = null;

      await retryWithTimeout({
        operationFn: async (abortSignal) => {
          receivedSignal = abortSignal;
          return true;
        },
        retryOptions: { timeoutInMilliseconds: 5000 }
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should throw on error when shouldRetryOnError is false (default)', async () => {
      await expect(retryWithTimeout({
        operationFn: async () => {
          throw new Error('fn error');
        },
        retryOptions: {
          timeoutInMilliseconds: 5000
        }
      })).rejects.toThrow();
    });

    it('should retry on error when shouldRetryOnError is true', async () => {
      let attempt = 0;

      await retryWithTimeout({
        operationFn: async () => {
          attempt++;
          if (attempt < 3) {
            throw new Error(`attempt ${String(attempt)} failed`);
          }
          return true;
        },
        retryOptions: {
          retryDelayInMilliseconds: 10,
          shouldRetryOnError: true,
          timeoutInMilliseconds: 5000
        }
      });

      expect(attempt).toBe(3);
    });

    it('should stop retrying when error is marked with marksAsTerminateRetry', async () => {
      let attempt = 0;

      await expect(retryWithTimeout({
        operationFn: async () => {
          attempt++;
          const error = new Error('terminate me');
          marksAsTerminateRetry(error);
          throw error;
        },
        retryOptions: {
          retryDelayInMilliseconds: 10,
          shouldRetryOnError: true,
          timeoutInMilliseconds: 5000
        }
      })).rejects.toThrow();

      expect(attempt).toBe(1);
    });

    it('should use default retry options when none are specified', async () => {
      const fn = vi.fn(async () => true);

      await retryWithTimeout({
        operationFn: fn
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should resolve when custom onTimeout terminates the operation', async () => {
      const onTimeout = vi.fn((ctx: TimeoutContext): void => {
        ctx.terminateOperation();
      });

      await expect(retryWithTimeout({
        onTimeout,
        operationFn: async () => false,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      })).resolves.toBeUndefined();
    });

    it('should call custom onTimeout when forwarded to runWithTimeout', async () => {
      const onTimeout = vi.fn((ctx: TimeoutContext): void => {
        ctx.terminateOperation();
      });

      await retryWithTimeout({
        onTimeout,
        operationFn: async () => false,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      });

      expect(onTimeout).toHaveBeenCalled();
    });
  });

  describe('addErrorHandler', () => {
    it('should resolve successfully when the async function succeeds', async () => {
      await expect(addErrorHandler(async () => {
        // Success
      })).resolves.toBeUndefined();
    });

    it('should emit async error event when the async function throws', async () => {
      const handler = vi.fn();
      const unregister = registerAsyncErrorEventHandler(handler);

      await addErrorHandler(async () => {
        throw new Error('async failure');
      });

      expect(handler).toHaveBeenCalledTimes(1);
      unregister();
    });

    it('should silently handle SilentError without emitting', async () => {
      const handler = vi.fn();
      const unregister = registerAsyncErrorEventHandler(handler);

      await addErrorHandler(async () => {
        throw new SilentError('quiet error');
      });

      expect(handler).not.toHaveBeenCalled();
      unregister();
    });

    it('should silently handle errors whose cause is a SilentError', async () => {
      const handler = vi.fn();
      const unregister = registerAsyncErrorEventHandler(handler);

      await addErrorHandler(async () => {
        throw new Error('wrapper', { cause: new SilentError('quiet') });
      });

      // The addErrorHandler wraps the thrown error in CustomStackTraceError,
      // So the chain is CustomStackTraceError -> Error -> SilentError
      expect(handler).not.toHaveBeenCalled();
      unregister();
    });
  });

  describe('invokeAsyncSafely', () => {
    it('should not throw when the async function succeeds', () => {
      expect(() => {
        invokeAsyncSafely(async () => {
          // Success
        });
      }).not.toThrow();
    });

    it('should not throw when the async function rejects', () => {
      // It should catch errors internally via addErrorHandler
      expect(() => {
        invokeAsyncSafely(async () => {
          throw new Error('should be caught');
        });
      }).not.toThrow();
    });

    it('should emit async error event when function throws', async () => {
      const handler = vi.fn();
      const unregister = registerAsyncErrorEventHandler(handler);

      invokeAsyncSafely(async () => {
        throw new Error('invoke error');
      });

      // Wait for microtasks to flush
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(handler).toHaveBeenCalledTimes(1);
      unregister();
    });
  });

  describe('invokeAsyncSafelyAfterDelay', () => {
    it('should not invoke the function immediately', () => {
      const fn = vi.fn(async () => {
        // Success
      });

      invokeAsyncSafelyAfterDelay(fn, 50);

      expect(fn).not.toHaveBeenCalled();
    });

    it('should invoke the function after a delay', async () => {
      const fn = vi.fn(async () => {
        // Success
      });

      invokeAsyncSafelyAfterDelay(fn, 50);

      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw if abortSignal is already aborted', () => {
      const controller = new AbortController();
      controller.abort(new Error('already aborted'));

      expect(() => {
        invokeAsyncSafelyAfterDelay(
          async () => {
            // Should not reach
          },
          0,
          undefined,
          controller.signal
        );
      }).toThrow();
    });

    it('should pass a non-null abortSignal to the async function', async () => {
      let receivedSignal: AbortSignal | null = null;

      invokeAsyncSafelyAfterDelay(async (abortSignal) => {
        receivedSignal = abortSignal;
      }, 10);

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(receivedSignal).not.toBeNull();
    });

    it('should pass an AbortSignal instance to the async function', async () => {
      let receivedSignal: AbortSignal | null = null;

      invokeAsyncSafelyAfterDelay(async (abortSignal) => {
        receivedSignal = abortSignal;
      }, 10);

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should default delay to 0', async () => {
      const fn = vi.fn(async () => {
        // Success
      });

      invokeAsyncSafelyAfterDelay(fn);

      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('convertAsyncToSync', () => {
    it('should return a function', () => {
      const asyncFn = vi.fn(async () => 42);
      const syncFn = convertAsyncToSync(asyncFn);
      expect(typeof syncFn).toBe('function');
    });

    it('should call the async function when the sync wrapper is invoked', () => {
      const asyncFn = vi.fn(async () => 42);
      const syncFn = convertAsyncToSync(asyncFn);
      syncFn();
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the async function', async () => {
      const asyncFn = vi.fn(async (a: number, b: string) => `${String(a)}-${b}`);
      const syncFn = convertAsyncToSync(asyncFn);

      syncFn(5, 'hello');

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(asyncFn).toHaveBeenCalledWith(5, 'hello');
    });

    it('should not throw synchronously when the async function rejects', () => {
      async function asyncFn(): Promise<never> {
        await noopAsync();
        throw new Error('async boom');
      }
      const syncFn = convertAsyncToSync(asyncFn);

      expect(() => {
        syncFn();
      }).not.toThrow();
    });

    it('should emit async error event when async function rejects', async () => {
      const handler = vi.fn();
      const unregister = registerAsyncErrorEventHandler(handler);

      async function asyncFn(): Promise<never> {
        await noopAsync();
        throw new Error('async error');
      }
      const syncFn = convertAsyncToSync(asyncFn);

      syncFn();

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(handler).toHaveBeenCalledTimes(1);
      unregister();
    });
  });

  describe('sleep edge cases', () => {
    it('should resolve early when abortSignal is aborted', async () => {
      const controller = new AbortController();

      setTimeout(() => {
        controller.abort(new Error('aborted'));
      }, 50);

      const start = Date.now();
      await sleep(10000, controller.signal);
      const elapsed = Date.now() - start;

      // Should have resolved much sooner than 10s
      expect(elapsed).toBeLessThan(5000);
    });

    it('should throw when shouldThrowOnAbort is true and signal is aborted', async () => {
      const controller = new AbortController();

      setTimeout(() => {
        controller.abort(new Error('abort reason'));
      }, 50);

      await expect(sleep(10000, controller.signal, true)).rejects.toThrow();
    });

    it('should not throw when shouldThrowOnAbort is false and signal is aborted', async () => {
      const controller = new AbortController();

      setTimeout(() => {
        controller.abort(new Error('abort reason'));
      }, 50);

      await expect(sleep(10000, controller.signal, false)).resolves.toBeUndefined();
    });

    it('should resolve normally when abortSignal is not aborted', async () => {
      const controller = new AbortController();

      await expect(sleep(50, controller.signal)).resolves.toBeUndefined();
    });
  });

  describe('timeout', () => {
    it('should reject with timeout error after the specified period', async () => {
      await expect(timeout(50)).rejects.toThrow('Timed out in 50 milliseconds');
    });

    it('should throw when shouldThrowOnAbort is true and signal is aborted before timeout', async () => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort(new Error('aborted early'));
      }, 10);

      await expect(timeout(5000, controller.signal, true)).rejects.toThrow();
    });
  });

  describe('setTimeoutAsync', () => {
    it('should resolve after the specified delay', async () => {
      const start = Date.now();
      await setTimeoutAsync(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(30);
    });

    it('should resolve with no delay argument', async () => {
      await expect(setTimeoutAsync()).resolves.toBeUndefined();
    });
  });

  describe('nextTickAsync', () => {
    it('should resolve on the next tick', async () => {
      await expect(nextTickAsync()).resolves.toBeUndefined();
    });
  });

  describe('queueMicrotaskAsync', () => {
    it('should resolve on the next microtask', async () => {
      await expect(queueMicrotaskAsync()).resolves.toBeUndefined();
    });
  });

  describe('setImmediateAsync', () => {
    it('should resolve on the next immediate', async () => {
      await expect(setImmediateAsync()).resolves.toBeUndefined();
    });
  });

  describe('asyncMap edge cases', () => {
    it('should call callback the correct number of times', async () => {
      const callback = vi.fn(async (v: number) => v * 2);
      const arr = [10, 20, 30];
      await asyncMap(arr, callback);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it.each([
      [1, 10, 0],
      [2, 20, 1],
      [3, 30, 2]
    ])('should pass correct arguments to callback on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const callback = vi.fn(async (v: number) => v * 2);
      const arr = [10, 20, 30];
      await asyncMap(arr, callback);
      expect(callback).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, arr);
    });

    it('should propagate errors from callback', async () => {
      // Use single element to avoid unhandled rejections from eagerly created promises
      await expect(asyncMap([1], async () => {
        throw new Error('map error');
      })).rejects.toThrow('map error');
    });

    it('should handle a single element', async () => {
      const result = await asyncMap([42], async (v) => v + 1);
      expect(result).toEqual([43]);
    });
  });

  describe('asyncFlatMap edge cases', () => {
    it('should call callback the correct number of times', async () => {
      const callback = vi.fn(async (v: number) => [v]);
      const arr = [10, 20];
      await asyncFlatMap(arr, callback);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it.each([
      [1, 10, 0],
      [2, 20, 1]
    ])('should pass correct arguments to callback on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const callback = vi.fn(async (v: number) => [v]);
      const arr = [10, 20];
      await asyncFlatMap(arr, callback);
      expect(callback).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, arr);
    });

    it('should propagate errors from callback', async () => {
      await expect(asyncFlatMap([1], async () => {
        throw new Error('flatMap error');
      })).rejects.toThrow('flatMap error');
    });

    it('should handle mixed empty and non-empty arrays', async () => {
      const result = await asyncFlatMap([1, 2, 3], async (v) => {
        return v === 2 ? [] : [v * 10];
      });
      expect(result).toEqual([10, 30]);
    });
  });

  describe('asyncFilter edge cases', () => {
    it('should propagate errors from predicate', async () => {
      await expect(asyncFilter([1, 2, 3], async () => {
        throw new Error('filter error');
      })).rejects.toThrow('filter error');
    });
  });

  describe('asyncFilterInPlace edge cases', () => {
    it('should propagate errors from predicate', async () => {
      const arr = [1, 2, 3];
      await expect(asyncFilterInPlace(arr, async () => {
        throw new Error('filterInPlace error');
      })).rejects.toThrow('filterInPlace error');
    });

    it('should call predicate the correct number of times', async () => {
      const predicate = vi.fn(async () => true);
      const arr = [10, 20, 30];
      await asyncFilterInPlace(arr, predicate);
      expect(predicate).toHaveBeenCalledTimes(3);
    });

    it.each([
      [1, 10, 0],
      [2, 20, 1],
      [3, 30, 2]
    ])('should pass correct arguments to predicate on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const predicate = vi.fn(async () => true);
      const arr = [10, 20, 30];
      await asyncFilterInPlace(arr, predicate);
      expect(predicate).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, arr);
    });
  });

  describe('neverEnds', () => {
    it('should never resolve', async () => {
      const resolve = vi.fn();
      neverEnds().then(resolve).catch(noop);
      await sleep(100);
      expect(resolve).not.toHaveBeenCalled();
    });

    it('should never reject', async () => {
      const reject = vi.fn();
      neverEnds().catch(reject).catch(noop);
      await sleep(100);
      expect(reject).not.toHaveBeenCalled();
    });
  });
});
