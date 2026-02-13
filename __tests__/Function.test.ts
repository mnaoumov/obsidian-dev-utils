import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  noop,
  noopAsync,
  omitAsyncReturnType,
  omitReturnType
} from '../src/Function.ts';

describe('Function', () => {
  describe('noop', () => {
    it('should return undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Need to test `void` as `undefined`.
      expect(noop()).toBeUndefined();
    });
  });

  describe('noopAsync', () => {
    it('should return a resolved promise', async () => {
      await expect(noopAsync()).resolves.toBeUndefined();
    });
  });

  describe('omitReturnType', () => {
    it('should call the wrapped function with correct arguments', () => {
      const fn = vi.fn((_a: number, _b: string) => 42);
      const wrapped = omitReturnType(fn);
      wrapped(1, 'hello');
      expect(fn).toHaveBeenCalledWith(1, 'hello');
    });

    it('should return undefined regardless of original return value', () => {
      function fn(): number {
        return 42;
      }
      const wrapped = omitReturnType(fn);
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Need to test `void` as `undefined`.
      expect(wrapped()).toBeUndefined();
    });

    it('should propagate thrown errors', () => {
      function fn(): never {
        throw new Error('test');
      }
      const wrapped = omitReturnType(fn);
      expect(() => {
        wrapped();
      }).toThrow('test');
    });
  });

  describe('omitAsyncReturnType', () => {
    it('should call the wrapped async function with correct arguments', async () => {
      const fn = vi.fn(async (_a: number) => 'result');
      const wrapped = omitAsyncReturnType(fn);
      await wrapped(5);
      expect(fn).toHaveBeenCalledWith(5);
    });

    it('should return a resolved promise with undefined', async () => {
      async function fn(): Promise<number> {
        await noopAsync();
        return 42;
      }
      const wrapped = omitAsyncReturnType(fn);
      await expect(wrapped()).resolves.toBeUndefined();
    });

    it('should propagate rejected promises', async () => {
      async function fn(): Promise<never> {
        await noopAsync();
        throw new Error('async error');
      }
      const wrapped = omitAsyncReturnType(fn);
      await expect(wrapped()).rejects.toThrow('async error');
    });
  });
});
