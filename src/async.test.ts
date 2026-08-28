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
  chain,
  convertAsyncToSync,
  convertSyncToAsync,
  disableAsyncOperationTracking,
  enableAsyncOperationTracking,
  handleSilentError,
  ignoreError,
  invokeAsyncSafely,
  invokeAsyncSafelyAfterDelay,
  isAsyncOperationTrackingEnabled,
  marksAsTerminateRetry,
  neverEnds,
  nextTickAsync,
  normalizePromisable,
  promiseAllAsyncFnsSequentially,
  promiseAllSequentially,
  queueMicrotaskAsync,
  requestAnimationFrameAsync,
  retryWithTimeout,
  runWithTimeout,
  setImmediateAsync,
  setTimeoutAsync,
  sleep,
  timeout,
  toArray,
  waitForAllAsyncOperations
} from './async.ts';
import { dispose } from './disposable.ts';
import {
  registerAsyncErrorEventHandler,
  SilentError,
  startAsyncErrorIgnoreContext,
  startCollectingUnhandledAsyncErrors,
  stopCollectingUnhandledAsyncErrors
} from './error.ts';
import {
  noop,
  noopAsync
} from './function.ts';
import {
  assertNonNullable,
  ensureNonNullable
} from './type-guards.ts';

describe('Async', () => {
  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not resolve before the specified delay', async () => {
      await noopAsync();
      const callback = vi.fn();
      sleep({ milliseconds: 1000 }).then(callback).catch(noop);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should resolve after the specified delay', async () => {
      const callback = vi.fn();
      const promise = sleep({ milliseconds: 1000 }).then(callback);
      await vi.advanceTimersByTimeAsync(1000);
      await promise;
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should resolve immediately for 0ms delay', async () => {
      const callback = vi.fn();
      const promise = sleep({ milliseconds: 0 }).then(callback);
      await vi.advanceTimersByTimeAsync(0);
      await promise;
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should be driven by fake timers even for large delays', async () => {
      // A large delay that would exceed the test timeout if `sleep` ran in real wall-clock time.
      // `sleep` must be fake-timer controllable here — it is built on `globalThis.setTimeout`, not on
      // `AbortSignal.timeout`, whose internal timer fake timers cannot advance.
      const callback = vi.fn();
      const promise = sleep({ milliseconds: 60_000 }).then(callback);
      await vi.advanceTimersByTimeAsync(60_000);
      await promise;
      expect(callback).toHaveBeenCalledOnce();
    });

    // Regression for Node portability. `sleep` (via `abortSignalTimeout`) builds its timer off
    // `globalThis.setTimeout`, not `window.setTimeout`, so it resolves where `window` is undefined.
    // A consumer integration-test hook that awaits `sleep` under vitest `environment: 'node'` would throw
    // `ReferenceError: window is not defined` without this fix.
    describe('without a DOM `window` (node environment)', () => {
      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should resolve when `window` is undefined', async () => {
        vi.stubGlobal('window', undefined);
        const callback = vi.fn();
        const promise = sleep({ milliseconds: 1000 }).then(callback);
        await vi.advanceTimersByTimeAsync(1000);
        await promise;
        expect(callback).toHaveBeenCalledOnce();
      });
    });
  });

  describe('asyncFilter', () => {
    it('should filter elements based on async predicate', async () => {
      const result = await asyncFilter([1, 2, 3, 4, 5], async (v) => {
        await noopAsync();
        return v % 2 === 0;
      });
      expect(result).toEqual([2, 4]);
    });

    it('should filter elements based on sync predicate', async () => {
      const result = await asyncFilter([10, 20, 30], (v) => v > 15);
      expect(result).toEqual([20, 30]);
    });

    it('should return an empty array when nothing matches', async () => {
      const result = await asyncFilter([1, 2, 3], async () => {
        await noopAsync();
        return false;
      });
      expect(result).toEqual([]);
    });

    it('should return all elements when everything matches', async () => {
      const result = await asyncFilter([1, 2, 3], async () => {
        await noopAsync();
        return true;
      });
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle an empty array', async () => {
      const result = await asyncFilter([], async () => {
        await noopAsync();
        return true;
      });
      expect(result).toEqual([]);
    });

    it('should call predicate the correct number of times', async () => {
      const predicate = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      const array = ['a', 'b', 'c'];
      await asyncFilter(array, predicate);
      expect(predicate).toHaveBeenCalledTimes(3);
    });

    it.each([
      [1, 'a', 0],
      [2, 'b', 1],
      [3, 'c', 2]
    ])('should pass correct arguments to predicate on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const predicate = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      const array = ['a', 'b', 'c'];
      await asyncFilter(array, predicate);
      expect(predicate).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, array);
    });

    it('should not mutate the original array', async () => {
      const original = [1, 2, 3, 4];
      await asyncFilter(original, async (v) => {
        await noopAsync();
        return v > 2;
      });
      expect(original).toEqual([1, 2, 3, 4]);
    });

    it('should return only matching elements from the original array', async () => {
      const original = [1, 2, 3, 4];
      const result = await asyncFilter(original, async (v) => {
        await noopAsync();
        return v > 2;
      });
      expect(result).toEqual([3, 4]);
    });

    it('should skip sparse array holes', async () => {
      // eslint-disable-next-line unicorn/no-new-array -- These tests are about sparse holes, which only `new Array(n)` produces. The rule's `Array.from({ length: n })` builds a dense array of `undefined`, so the hole handling under test would no longer be exercised.
      const array = new Array<number>(5);
      array[1] = 10;
      array[3] = 30;
      const result = await asyncFilter(array, async () => {
        await noopAsync();
        return true;
      });
      expect(result).toEqual([10, 30]);
    });
  });

  describe('asyncFilterInPlace', () => {
    it('should filter elements in place based on async predicate', async () => {
      const array = [1, 2, 3, 4, 5];
      await asyncFilterInPlace(array, async (v) => {
        await noopAsync();
        return v % 2 !== 0;
      });
      expect(array).toEqual([1, 3, 5]);
    });

    it('should handle an empty array', async () => {
      const array: number[] = [];
      await asyncFilterInPlace(array, async () => {
        await noopAsync();
        return true;
      });
      expect(array).toEqual([]);
    });

    it('should remove all elements when predicate always returns false', async () => {
      const array = [1, 2, 3];
      await asyncFilterInPlace(array, async () => {
        await noopAsync();
        return false;
      });
      expect(array).toEqual([]);
    });

    it('should set length to 0 when predicate always returns false', async () => {
      const array = [1, 2, 3];
      await asyncFilterInPlace(array, async () => {
        await noopAsync();
        return false;
      });
      expect(array.length).toBe(0);
    });

    it('should keep all elements when predicate always returns true', async () => {
      const array = [1, 2, 3];
      await asyncFilterInPlace(array, async () => {
        await noopAsync();
        return true;
      });
      expect(array).toEqual([1, 2, 3]);
    });

    it('should update array content correctly after filtering', async () => {
      const array = [10, 20, 30, 40, 50];
      await asyncFilterInPlace(array, async (v) => {
        await noopAsync();
        return v >= 30;
      });
      expect(array).toEqual([30, 40, 50]);
    });

    it('should update array length correctly after filtering', async () => {
      const array = [10, 20, 30, 40, 50];
      await asyncFilterInPlace(array, async (v) => {
        await noopAsync();
        return v >= 30;
      });
      expect(array.length).toBe(3);
    });

    it('should skip sparse array holes and keep only defined elements', async () => {
      // eslint-disable-next-line unicorn/no-new-array -- These tests are about sparse holes, which only `new Array(n)` produces. The rule's `Array.from({ length: n })` builds a dense array of `undefined`, so the hole handling under test would no longer be exercised.
      const array = new Array<number>(5);
      array[1] = 10;
      array[3] = 30;
      await asyncFilterInPlace(array, async () => {
        await noopAsync();
        return true;
      });
      expect(array).toEqual([10, 30]);
    });

    it('should update length correctly after filtering sparse arrays', async () => {
      // eslint-disable-next-line unicorn/no-new-array -- These tests are about sparse holes, which only `new Array(n)` produces. The rule's `Array.from({ length: n })` builds a dense array of `undefined`, so the hole handling under test would no longer be exercised.
      const array = new Array<number>(5);
      array[1] = 10;
      array[3] = 30;
      await asyncFilterInPlace(array, async () => {
        await noopAsync();
        return true;
      });
      expect(array.length).toBe(2);
    });
  });

  describe('asyncMap', () => {
    it('should map elements with async callback', async () => {
      const result = await asyncMap([1, 2, 3], async (v) => {
        await noopAsync();
        return v * 2;
      });
      expect(result).toEqual([2, 4, 6]);
    });

    it('should map elements with sync callback', async () => {
      const result = await asyncMap([1, 2, 3], (v) => v.toString());
      expect(result).toEqual(['1', '2', '3']);
    });

    it('should handle an empty array', async () => {
      const result = await asyncMap([], async (v: number) => {
        await noopAsync();
        return v * 2;
      });
      expect(result).toEqual([]);
    });

    it('should not mutate the original array', async () => {
      const original = [1, 2, 3];
      await asyncMap(original, async (v) => {
        await noopAsync();
        return v + 10;
      });
      expect(original).toEqual([1, 2, 3]);
    });

    it('should return the mapped results', async () => {
      const original = [1, 2, 3];
      const result = await asyncMap(original, async (v) => {
        await noopAsync();
        return v + 10;
      });
      expect(result).toEqual([11, 12, 13]);
    });
  });

  describe('asyncFlatMap', () => {
    it('should map and flatten results', async () => {
      const result = await asyncFlatMap([1, 2, 3], async (v) => {
        await noopAsync();
        return [v, v * 10];
      });
      expect(result).toEqual([1, 10, 2, 20, 3, 30]);
    });

    it('should handle callbacks that return empty arrays', async () => {
      const result = await asyncFlatMap([1, 2, 3], async () => {
        await noopAsync();
        return [];
      });
      expect(result).toEqual([]);
    });

    it('should handle an empty input array', async () => {
      const result = await asyncFlatMap([], async (v: number) => {
        await noopAsync();
        return [v];
      });
      expect(result).toEqual([]);
    });

    it('should flatten only one level', async () => {
      const result = await asyncFlatMap([1], async () => {
        await noopAsync();
        return [[1, 2], [3, 4]];
      });
      expect(result).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('convertSyncToAsync', () => {
    it('should wrap a sync function into an async one', async () => {
      function syncFunction(a: number, b: number): number {
        return a + b;
      }
      const asyncFunction = convertSyncToAsync(syncFunction);
      const result = await asyncFunction(3, 4);
      expect(result).toBe(7);
    });

    it('should return a promise', () => {
      function syncFunction(): string {
        return 'hello';
      }
      const asyncFunction = convertSyncToAsync(syncFunction);
      const result = asyncFunction();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should propagate thrown errors as rejected promises', async () => {
      function syncFunction(): never {
        throw new Error('sync boom');
      }
      const asyncFunction = convertSyncToAsync(syncFunction);
      await expect(asyncFunction()).rejects.toThrow('sync boom');
    });

    it('should pass arguments correctly', async () => {
      const syncFunction = vi.fn((x: string) => x.toUpperCase());
      const asyncFunction = convertSyncToAsync(syncFunction);
      await asyncFunction('test');
      expect(syncFunction).toHaveBeenCalledWith('test');
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
          await noopAsync();
          order.push(1);
          return 'a';
        },
        async (): Promise<string> => {
          await noopAsync();
          order.push(2);
          return 'b';
        },
        async (): Promise<string> => {
          await noopAsync();
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
          await noopAsync();
          order.push(1);
          return 'a';
        },
        async (): Promise<string> => {
          await noopAsync();
          order.push(2);
          return 'b';
        },
        async (): Promise<string> => {
          await noopAsync();
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
      const function3 = vi.fn(async (): Promise<string> => {
        await noopAsync();
        return 'c';
      });
      await expect(
        promiseAllAsyncFnsSequentially([
          async (): Promise<string> => {
            await noopAsync();
            return 'a';
          },
          async (): Promise<never> => {
            await noopAsync();
            throw new Error('seq fail');
          },
          function3
        ])
      ).rejects.toThrow('seq fail');
      expect(function3).not.toHaveBeenCalled();
    });

    it('should execute functions one at a time, not in parallel', async () => {
      let concurrency = 0;
      let maxConcurrency = 0;
      async function $function(): Promise<void> {
        concurrency++;
        maxConcurrency = Math.max(maxConcurrency, concurrency);
        await noopAsync();
        concurrency--;
      }
      await promiseAllAsyncFnsSequentially([$function, $function, $function]);
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
        await noopAsync();
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
        await noopAsync();
        yield 'only';
      }
      const result = await toArray(gen());
      expect(result).toEqual(['only']);
    });

    it('should preserve element order', async () => {
      async function* gen(): AsyncGenerator<string, void> {
        await noopAsync();
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
        operationFunction: async () => {
          await noopAsync();
          return 42;
        },
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe(42);
    });

    it('should return the result for synchronous operationFunction', async () => {
      const result = await runWithTimeout({
        operationFunction: () => 'sync result',
        timeoutInMilliseconds: 5000
      });
      expect(result).toBe('sync result');
    });

    it('should throw when operation times out with default onTimeout', async () => {
      await expect(runWithTimeout({
        operationFunction: async () => {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 10_000);
          });
          return 'late';
        },
        timeoutInMilliseconds: 50
      })).rejects.toThrow('Run with timeout failed');
    });

    it('should throw when operationFunction throws an error', async () => {
      await expect(runWithTimeout({
        operationFunction: async () => {
          await noopAsync();
          throw new Error('operation failed');
        },
        timeoutInMilliseconds: 5000
      })).rejects.toThrow('Run with timeout failed');
    });

    it('should reject even when operationFunction resolves after being terminated by the timeout', async () => {
      // OperationFn watches the abort signal and resolves (does NOT throw) once aborted, mirroring how
      // RetryWithTimeout's loop exits on abort. The timeout terminated the run, so runWithTimeout must
      // Reject rather than return the value produced after the deadline.
      await expect(runWithTimeout({
        async operationFunction(abortSignal) {
          await new Promise<void>((resolve) => {
            abortSignal.addEventListener('abort', () => {
              resolve();
            });
          });
          return 'resolved after abort';
        },
        timeoutInMilliseconds: 50
      })).rejects.toThrow('Run with timeout failed');
    });

    it('should reject when custom onTimeout handler terminates the operation', async () => {
      const onTimeout = vi.fn((context: TimeoutContext): void => {
        context.terminateOperation();
      });

      await expect(runWithTimeout({
        onTimeout,
        operationFunction: async () => {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 10_000);
          });
          return 'late';
        },
        timeoutInMilliseconds: 50
      })).rejects.toThrow();
    });

    it('should call custom onTimeout handler when timeout occurs', async () => {
      const onTimeout = vi.fn((context: TimeoutContext): void => {
        context.terminateOperation();
      });

      try {
        await runWithTimeout({
          onTimeout,
          operationFunction: async () => {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 10_000);
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
      const onTimeout = vi.fn((context: TimeoutContext): void => {
        context.terminateOperation();
      });

      try {
        await runWithTimeout({
          onTimeout,
          operationFunction: async () => {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 10_000);
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
      let capturedContext: null | TimeoutContext = null;

      try {
        await runWithTimeout({
          onTimeout(context) {
            capturedContext = context;
            context.terminateOperation();
          },
          operationFunction: async () => {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 10_000);
            });
          },
          operationName: 'myOperation',
          timeoutInMilliseconds: 50
        });
      } catch {
        // Expected
      }

      expect(capturedContext).not.toBeNull();
    });

    it('should set operationName on the captured TimeoutContext', async () => {
      let capturedContext: null | TimeoutContext = null;

      try {
        await runWithTimeout({
          onTimeout(context) {
            capturedContext = context;
            context.terminateOperation();
          },
          operationFunction: async () => {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 10_000);
            });
          },
          operationName: 'myOperation',
          timeoutInMilliseconds: 50
        });
      } catch {
        // Expected
      }

      capturedContext = ensureNonNullable(capturedContext as null | TimeoutContext);
      expect(capturedContext.operationName).toBe('myOperation');
    });

    it('should return the result when onTimeout does not terminate', async () => {
      const result = await runWithTimeout({
        onTimeout(context) {
          context.onOperationCompleted(() => {
            // Do not terminate - let the operation finish on its own
          });
        },
        async operationFunction() {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 100);
          });
          return 'finished';
        },
        timeoutInMilliseconds: 10
      });

      expect(result).toBe('finished');
    });

    it('should call onOperationCompleted callback when operation finishes after timeout', async () => {
      let wasCompletedCallbackCalled = false;

      await runWithTimeout({
        onTimeout(context) {
          context.onOperationCompleted(() => {
            wasCompletedCallbackCalled = true;
          });
        },
        async operationFunction() {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 100);
          });
          return 'finished';
        },
        timeoutInMilliseconds: 10
      });

      expect(wasCompletedCallbackCalled).toBe(true);
    });

    it('should pass abortSignal to operationFunction', async () => {
      let receivedSignal: AbortSignal | null = null;

      await runWithTimeout({
        operationFunction(abortSignal) {
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
          operationFunction: async (abortSignal) => {
            receivedSignal = abortSignal;
            await new Promise((resolve) => {
              window.setTimeout(resolve, 10_000);
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
    it('should resolve when operationFunction returns true on first attempt', async () => {
      const $function = vi.fn(async () => {
        await noopAsync();
        return true;
      });

      await retryWithTimeout({
        operationFunction: $function,
        retryOptions: { timeoutInMilliseconds: 5000 }
      });

      expect($function).toHaveBeenCalledTimes(1);
    });

    it('should retry until operationFunction returns true', async () => {
      let attempt = 0;
      const $function = vi.fn(async () => {
        await noopAsync();
        attempt++;
        return attempt >= 3;
      });

      await retryWithTimeout({
        operationFunction: $function,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 5000
        }
      });

      expect($function).toHaveBeenCalledTimes(3);
    });

    it('should reject when timeout is reached and the while loop exits due to abort', async () => {
      const $function = vi.fn(async () => {
        await noopAsync();
        return false;
      });

      await expect(retryWithTimeout({
        operationFunction: $function,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      })).rejects.toThrow();
    });

    it('should have called operationFunction at least once before timeout', async () => {
      const $function = vi.fn(async () => {
        await noopAsync();
        return false;
      });

      await expect(retryWithTimeout({
        operationFunction: $function,
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      })).rejects.toThrow();

      expect($function.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw immediately if abortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(new Error('already aborted'));

      await expect(retryWithTimeout({
        operationFunction: async () => {
          await noopAsync();
          return true;
        },
        retryOptions: {
          abortSignal: controller.signal,
          timeoutInMilliseconds: 5000
        }
      })).rejects.toThrow();
    });

    it('should pass an AbortSignal instance to operationFunction', async () => {
      let receivedSignal: AbortSignal | null = null;

      await retryWithTimeout({
        operationFunction: async (abortSignal) => {
          await noopAsync();
          receivedSignal = abortSignal;
          return true;
        },
        retryOptions: { timeoutInMilliseconds: 5000 }
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should throw on error when shouldRetryOnError is false (default)', async () => {
      await expect(retryWithTimeout({
        operationFunction: async () => {
          await noopAsync();
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
        operationFunction: async () => {
          await noopAsync();
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
        operationFunction: async () => {
          await noopAsync();
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
      const $function = vi.fn(async () => {
        await noopAsync();
        return true;
      });

      await retryWithTimeout({
        operationFunction: $function
      });

      expect($function).toHaveBeenCalledTimes(1);
    });

    it('should reject when custom onTimeout terminates the operation', async () => {
      const onTimeout = vi.fn((context: TimeoutContext): void => {
        context.terminateOperation();
      });

      await expect(retryWithTimeout({
        onTimeout,
        operationFunction: async () => {
          await noopAsync();
          return false;
        },
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      })).rejects.toThrow();
    });

    it('should call custom onTimeout when forwarded to runWithTimeout', async () => {
      const onTimeout = vi.fn((context: TimeoutContext): void => {
        context.terminateOperation();
      });

      await expect(retryWithTimeout({
        onTimeout,
        operationFunction: async () => {
          await noopAsync();
          return false;
        },
        retryOptions: {
          retryDelayInMilliseconds: 10,
          timeoutInMilliseconds: 80
        }
      })).rejects.toThrow();

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
      using _registration = registerAsyncErrorEventHandler(handler);
      // A registered handler does not exempt the emit, so mark it as expected for the test harness.
      using _ignore = startAsyncErrorIgnoreContext();

      await addErrorHandler(async () => {
        await noopAsync();
        throw new Error('async failure');
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should silently handle SilentError without emitting', async () => {
      const handler = vi.fn();
      using _registration = registerAsyncErrorEventHandler(handler);

      await addErrorHandler(async () => {
        await noopAsync();
        throw new SilentError('quiet error');
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should silently handle errors whose cause is a SilentError', async () => {
      const handler = vi.fn();
      using _registration = registerAsyncErrorEventHandler(handler);

      await addErrorHandler(async () => {
        await noopAsync();
        throw new Error('wrapper', { cause: new SilentError('quiet') });
      });

      // The addErrorHandler wraps the thrown error in CustomStackTraceError,
      // So the chain is CustomStackTraceError -> Error -> SilentError
      expect(handler).not.toHaveBeenCalled();
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
      // It should catch errors internally via addErrorHandler. The ignore context, captured at schedule
      // Time, keeps the deferred rejection from being reported as unhandled — no manual drain needed.
      using _ignore = startAsyncErrorIgnoreContext();
      expect(() => {
        invokeAsyncSafely(async () => {
          await noopAsync();
          throw new Error('should be caught');
        });
      }).not.toThrow();
    });

    it('should emit async error event when function throws', async () => {
      const handler = vi.fn();
      using _registration = registerAsyncErrorEventHandler(handler);
      // A registered handler does not exempt the emit, so mark it as expected for the test harness.
      using _ignore = startAsyncErrorIgnoreContext();

      invokeAsyncSafely(async () => {
        await noopAsync();
        throw new Error('invoke error');
      });

      // Wait for microtasks to flush
      await new Promise((resolve) => {
        window.setTimeout(resolve, 50);
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not throw when a sync function succeeds', () => {
      expect(() => {
        invokeAsyncSafely(() => {
          // Sync success — no promise returned
        });
      }).not.toThrow();
    });

    it('should emit async error event when a sync function throws', async () => {
      const handler = vi.fn();
      using _registration = registerAsyncErrorEventHandler(handler);
      // A registered handler does not exempt the emit, so mark it as expected for the test harness.
      using _ignore = startAsyncErrorIgnoreContext();

      invokeAsyncSafely(() => {
        throw new Error('sync invoke error');
      });

      // Wait for microtasks to flush
      await new Promise((resolve) => {
        window.setTimeout(resolve, 50);
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit async error event when a non-async function returns a rejecting promise', async () => {
      const handler = vi.fn();
      using _registration = registerAsyncErrorEventHandler(handler);
      // A registered handler does not exempt the emit, so mark it as expected for the test harness.
      using _ignore = startAsyncErrorIgnoreContext();

      invokeAsyncSafely(() => Promise.reject(new Error('rejected promise')));

      // Wait for microtasks to flush
      await new Promise((resolve) => {
        window.setTimeout(resolve, 50);
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('async operation tracking', () => {
    afterEach(() => {
      disableAsyncOperationTracking();
    });

    it('should wait for tracked fire-and-forget operations to settle', async () => {
      enableAsyncOperationTracking();
      let didComplete = false;
      invokeAsyncSafely(async () => {
        await noopAsync();
        didComplete = true;
      });

      await waitForAllAsyncOperations();

      expect(didComplete).toBe(true);
    });

    it('should drain operations scheduled while waiting', async () => {
      enableAsyncOperationTracking();
      let completedCount = 0;
      invokeAsyncSafely(async () => {
        await noopAsync();
        completedCount++;
        invokeAsyncSafely(async () => {
          await noopAsync();
          completedCount++;
        });
      });

      await waitForAllAsyncOperations();

      const EXPECTED_COMPLETED_COUNT = 2;
      expect(completedCount).toBe(EXPECTED_COMPLETED_COUNT);
    });

    it('should throw when tracking is disabled instead of silently resolving', async () => {
      disableAsyncOperationTracking();
      await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
    });

    it('should disable tracking when the returned disposable is disposed', async () => {
      const disposable = enableAsyncOperationTracking();
      dispose(disposable);
      await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
    });

    it('should keep tracking enabled inside a using scope and disable it on exit', async () => {
      {
        using _tracking = enableAsyncOperationTracking();
        await expect(waitForAllAsyncOperations()).resolves.toBeUndefined();
      }
      await expect(waitForAllAsyncOperations()).rejects.toThrow('Async operation tracking is not enabled');
    });

    it('should report whether tracking is currently enabled', () => {
      disableAsyncOperationTracking();
      expect(isAsyncOperationTrackingEnabled()).toBe(false);

      enableAsyncOperationTracking();
      expect(isAsyncOperationTrackingEnabled()).toBe(true);

      disableAsyncOperationTracking();
      expect(isAsyncOperationTrackingEnabled()).toBe(false);
    });
  });

  describe('addErrorHandler ignore context', () => {
    afterEach(() => {
      stopCollectingUnhandledAsyncErrors();
      disableAsyncOperationTracking();
    });

    it('should ignore a fire-and-forget rejection scheduled within an ignore context', async () => {
      enableAsyncOperationTracking();
      startCollectingUnhandledAsyncErrors();
      {
        using _ignore = startAsyncErrorIgnoreContext();
        invokeAsyncSafely(() => Promise.reject(new Error('scheduled within context')));
      }

      // The context has already exited, but the deferred rejection is still ignored because
      // AddErrorHandler captured the active ignore context at schedule time.
      await waitForAllAsyncOperations();

      expect(stopCollectingUnhandledAsyncErrors()).toStrictEqual([]);
    });

    it('should collect a fire-and-forget rejection scheduled outside any ignore context', async () => {
      enableAsyncOperationTracking();
      startCollectingUnhandledAsyncErrors();

      invokeAsyncSafely(() => Promise.reject(new Error('scheduled outside context')));

      await waitForAllAsyncOperations();

      expect(stopCollectingUnhandledAsyncErrors()).toHaveLength(1);
    });
  });

  describe('invokeAsyncSafelyAfterDelay', () => {
    it('should not invoke the function immediately', () => {
      const $function = vi.fn(async () => {
        // Success
      });

      invokeAsyncSafelyAfterDelay({ asyncFunction: $function, delayInMilliseconds: 50 });

      expect($function).not.toHaveBeenCalled();
    });

    it('should invoke the function after a delay', async () => {
      const $function = vi.fn(async () => {
        // Success
      });

      invokeAsyncSafelyAfterDelay({ asyncFunction: $function, delayInMilliseconds: 50 });

      await new Promise((resolve) => {
        window.setTimeout(resolve, 150);
      });

      expect($function).toHaveBeenCalledTimes(1);
    });

    it('should throw if abortSignal is already aborted', () => {
      const controller = new AbortController();
      controller.abort(new Error('already aborted'));

      expect(() => {
        invokeAsyncSafelyAfterDelay({
          abortSignal: controller.signal,
          asyncFunction: async () => {
            // Should not reach
          },
          delayInMilliseconds: 0
        });
      }).toThrow();
    });

    it('should pass a non-null abortSignal to the async function', async () => {
      let receivedSignal: AbortSignal | null = null;

      invokeAsyncSafelyAfterDelay({
        asyncFunction: async (abortSignal) => {
          await noopAsync();
          receivedSignal = abortSignal;
        },
        delayInMilliseconds: 10
      });

      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });

      expect(receivedSignal).not.toBeNull();
    });

    it('should pass an AbortSignal instance to the async function', async () => {
      let receivedSignal: AbortSignal | null = null;

      invokeAsyncSafelyAfterDelay({
        asyncFunction: async (abortSignal) => {
          await noopAsync();
          receivedSignal = abortSignal;
        },
        delayInMilliseconds: 10
      });

      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should default delay to 0', async () => {
      const $function = vi.fn(async () => {
        // Success
      });

      invokeAsyncSafelyAfterDelay({ asyncFunction: $function });

      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });

      expect($function).toHaveBeenCalledTimes(1);
    });
  });

  describe('convertAsyncToSync', () => {
    it('should return a function', () => {
      const asyncFunction = vi.fn(async () => {
        await noopAsync();
        return 42;
      });
      const syncFunction = convertAsyncToSync(asyncFunction);
      expect(typeof syncFunction).toBe('function');
    });

    it('should call the async function when the sync wrapper is invoked', () => {
      const asyncFunction = vi.fn(async () => {
        await noopAsync();
        return 42;
      });
      const syncFunction = convertAsyncToSync(asyncFunction);
      syncFunction();
      expect(asyncFunction).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the async function', async () => {
      const asyncFunction = vi.fn(async (a: number, b: string) => {
        await noopAsync();
        return `${String(a)}-${b}`;
      });
      const syncFunction = convertAsyncToSync(asyncFunction);

      syncFunction(5, 'hello');

      await new Promise((resolve) => {
        window.setTimeout(resolve, 50);
      });

      expect(asyncFunction).toHaveBeenCalledWith(5, 'hello');
    });

    it('should not throw synchronously when the async function rejects', () => {
      using _ignore = startAsyncErrorIgnoreContext();

      async function asyncFunction(): Promise<never> {
        await noopAsync();
        throw new Error('async boom');
      }
      const syncFunction = convertAsyncToSync(asyncFunction);

      expect(() => {
        syncFunction();
      }).not.toThrow();
    });

    it('should emit async error event when async function rejects', async () => {
      const handler = vi.fn();
      using _registration = registerAsyncErrorEventHandler(handler);
      // A registered handler does not exempt the emit, so mark it as expected for the test harness.
      using _ignore = startAsyncErrorIgnoreContext();

      async function asyncFunction(): Promise<never> {
        await noopAsync();
        throw new Error('async error');
      }
      const syncFunction = convertAsyncToSync(asyncFunction);

      syncFunction();

      await new Promise((resolve) => {
        window.setTimeout(resolve, 50);
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('sleep edge cases', () => {
    it('should resolve early when abortSignal is aborted', async () => {
      const controller = new AbortController();

      window.setTimeout(() => {
        controller.abort(new Error('aborted'));
      }, 50);

      const start = Date.now();
      await sleep({ abortSignal: controller.signal, milliseconds: 10_000 });
      const elapsed = Date.now() - start;

      // Should have resolved much sooner than 10s
      expect(elapsed).toBeLessThan(5000);
    });

    it('should throw when shouldThrowOnAbort is true and signal is aborted', async () => {
      const controller = new AbortController();

      window.setTimeout(() => {
        controller.abort(new Error('abort reason'));
      }, 50);

      await expect(sleep({ abortSignal: controller.signal, milliseconds: 10_000, shouldThrowOnAbort: true })).rejects.toThrow();
    });

    it('should not throw when shouldThrowOnAbort is false and signal is aborted', async () => {
      const controller = new AbortController();

      window.setTimeout(() => {
        controller.abort(new Error('abort reason'));
      }, 50);

      await expect(sleep({ abortSignal: controller.signal, milliseconds: 10_000, shouldThrowOnAbort: false })).resolves.toBeUndefined();
    });

    it('should resolve normally when abortSignal is not aborted', async () => {
      const controller = new AbortController();

      await expect(sleep({ abortSignal: controller.signal, milliseconds: 50 })).resolves.toBeUndefined();
    });
  });

  describe('timeout', () => {
    it('should reject with timeout error after the specified period', async () => {
      await expect(timeout({ timeoutInMilliseconds: 50 })).rejects.toThrow('Timed out in 50 milliseconds');
    });

    it('should throw when shouldThrowOnAbort is true and signal is aborted before timeout', async () => {
      const controller = new AbortController();
      window.setTimeout(() => {
        controller.abort(new Error('aborted early'));
      }, 10);

      await expect(timeout({ abortSignal: controller.signal, shouldThrowOnAbort: true, timeoutInMilliseconds: 5000 })).rejects.toThrow();
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

  describe('normalizePromisable', () => {
    it('should return the same native Promise instance', async () => {
      const promise = Promise.resolve(42);
      const result = normalizePromisable(promise);
      expect(result).toBe(promise);
      await expect(result).resolves.toBe(42);
    });

    it('should wrap a non-Promise thenable into a native Promise', async () => {
      const thenable: PromiseLike<number> = {
        // eslint-disable-next-line unicorn/no-thenable -- A hand-built thenable is the subject of this test, not an accident.
        then(onFulfilled) {
          return normalizePromisable(Promise.resolve(onFulfilled?.(7)));
        }
      };
      const result = normalizePromisable(thenable);
      expect(result).toBeInstanceOf(Promise);
      expect(result).not.toBe(thenable);
      await expect(result).resolves.toBe(7);
    });

    it('should return a plain value as-is', () => {
      expect(normalizePromisable(42)).toBe(42);
    });

    it('should return a nullish value as-is without probing then', () => {
      expect(normalizePromisable(undefined)).toBeUndefined();
      expect(normalizePromisable(null)).toBeNull();
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
      const callback = vi.fn(async (v: number) => {
        await noopAsync();
        return v * 2;
      });
      const array = [10, 20, 30];
      await asyncMap(array, callback);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it.each([
      [1, 10, 0],
      [2, 20, 1],
      [3, 30, 2]
    ])('should pass correct arguments to callback on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const callback = vi.fn(async (v: number) => {
        await noopAsync();
        return v * 2;
      });
      const array = [10, 20, 30];
      await asyncMap(array, callback);
      expect(callback).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, array);
    });

    it('should propagate errors from callback', async () => {
      // Use single element to avoid unhandled rejections from eagerly created promises
      await expect(asyncMap([1], async () => {
        await noopAsync();
        throw new Error('map error');
      })).rejects.toThrow('map error');
    });

    it('should handle a single element', async () => {
      const result = await asyncMap([42], async (v) => {
        await noopAsync();
        return v + 1;
      });
      expect(result).toEqual([43]);
    });
  });

  describe('asyncFlatMap edge cases', () => {
    it('should call callback the correct number of times', async () => {
      const callback = vi.fn(async (v: number) => {
        await noopAsync();
        return [v];
      });
      const array = [10, 20];
      await asyncFlatMap(array, callback);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it.each([
      [1, 10, 0],
      [2, 20, 1]
    ])('should pass correct arguments to callback on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const callback = vi.fn(async (v: number) => {
        await noopAsync();
        return [v];
      });
      const array = [10, 20];
      await asyncFlatMap(array, callback);
      expect(callback).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, array);
    });

    it('should propagate errors from callback', async () => {
      await expect(asyncFlatMap([1], async () => {
        await noopAsync();
        throw new Error('flatMap error');
      })).rejects.toThrow('flatMap error');
    });

    it('should handle mixed empty and non-empty arrays', async () => {
      const result = await asyncFlatMap([1, 2, 3], async (v) => {
        await noopAsync();
        return v === 2 ? [] : [v * 10];
      });
      expect(result).toEqual([10, 30]);
    });
  });

  describe('asyncFilter edge cases', () => {
    it('should propagate errors from predicate', async () => {
      await expect(asyncFilter([1, 2, 3], async () => {
        await noopAsync();
        throw new Error('filter error');
      })).rejects.toThrow('filter error');
    });
  });

  describe('asyncFilterInPlace edge cases', () => {
    it('should propagate errors from predicate', async () => {
      const array = [1, 2, 3];
      await expect(asyncFilterInPlace(array, async () => {
        await noopAsync();
        throw new Error('filterInPlace error');
      })).rejects.toThrow('filterInPlace error');
    });

    it('should call predicate the correct number of times', async () => {
      const predicate = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      const array = [10, 20, 30];
      await asyncFilterInPlace(array, predicate);
      expect(predicate).toHaveBeenCalledTimes(3);
    });

    it.each([
      [1, 10, 0],
      [2, 20, 1],
      [3, 30, 2]
    ])('should pass correct arguments to predicate on call %i', async (callIndex, expectedValue, expectedIndex) => {
      const predicate = vi.fn(async () => {
        await noopAsync();
        return true;
      });
      const array = [10, 20, 30];
      await asyncFilterInPlace(array, predicate);
      expect(predicate).toHaveBeenNthCalledWith(callIndex, expectedValue, expectedIndex, array);
    });
  });

  describe('neverEnds', () => {
    it('should never resolve', async () => {
      const resolve = vi.fn();
      neverEnds().then(resolve).catch(noop);
      await sleep({ milliseconds: 100 });
      expect(resolve).not.toHaveBeenCalled();
    });

    it('should never reject', async () => {
      const reject = vi.fn();
      neverEnds().catch(reject).catch(noop);
      await sleep({ milliseconds: 100 });
      expect(reject).not.toHaveBeenCalled();
    });
  });

  describe('chain', () => {
    it('should return null when there is no chain promise and the function returns null', () => {
      expect(chain(null, () => null)).toBeNull();
    });

    it('should return the Promise produced by the function when there is no chain promise', async () => {
      const inner = noopAsync();
      const result = chain(null, () => inner);
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('should wrap a non-Promise thenable produced by the function when there is no chain promise', async () => {
      let wasResolved = false;
      const thenable: PromiseLike<void> = {
        // eslint-disable-next-line unicorn/no-thenable -- A hand-built thenable is the subject of this test, not an accident.
        then(onFulfilled) {
          wasResolved = true;
          return Promise.resolve(onFulfilled?.());
        }
      };
      const result = chain(null, () => thenable);
      expect(result).toBeInstanceOf(Promise);
      await result;
      expect(wasResolved).toBe(true);
    });

    it('should chain after an existing promise when the function returns a value', async () => {
      const order: number[] = [];
      const first = noopAsync().then(() => {
        order.push(1);
      });
      const result = chain(first, () =>
        noopAsync().then(() => {
          order.push(2);
        }));
      assertNonNullable(result);
      await result;
      expect(order).toEqual([1, 2]);
    });

    it('should chain after an existing promise when the function returns null', async () => {
      const order: number[] = [];
      const first = noopAsync().then(() => {
        order.push(1);
      });
      const result = chain(first, () => null);
      assertNonNullable(result);
      await result;
      expect(order).toEqual([1]);
    });
  });

  describe('requestAnimationFrameAsync', () => {
    it('should resolve on the next animation frame', async () => {
      const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);
        return 0;
      });

      await requestAnimationFrameAsync();

      expect(requestAnimationFrameSpy).toHaveBeenCalledOnce();
      requestAnimationFrameSpy.mockRestore();
    });

    it('should resolve via the fallback timeout when the animation frame does not fire', async () => {
      const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0);

      await requestAnimationFrameAsync(1);

      expect(requestAnimationFrameSpy).toHaveBeenCalledOnce();
      requestAnimationFrameSpy.mockRestore();
    });

    it('should disable the fallback timeout when fallbackInMilliseconds is 0', async () => {
      const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);
        return 0;
      });

      await requestAnimationFrameAsync(0);

      expect(requestAnimationFrameSpy).toHaveBeenCalledOnce();
      requestAnimationFrameSpy.mockRestore();
    });
  });
});
