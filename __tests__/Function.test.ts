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
      const fn = (): number => 42;
      const wrapped = omitReturnType(fn);
      expect(wrapped()).toBeUndefined();
    });

    it('should propagate thrown errors', () => {
      const fn = (): never => {
        throw new Error('test');
      };
      const wrapped = omitReturnType(fn);
      expect(() => wrapped()).toThrow('test');
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
      const fn = async (): Promise<number> => 42;
      const wrapped = omitAsyncReturnType(fn);
      await expect(wrapped()).resolves.toBeUndefined();
    });

    it('should propagate rejected promises', async () => {
      const fn = async (): Promise<never> => {
        throw new Error('async error');
      };
      const wrapped = omitAsyncReturnType(fn);
      await expect(wrapped()).rejects.toThrow('async error');
    });
  });
});
