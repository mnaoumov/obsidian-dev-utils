import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getFunctionExpressionString,
  noop,
  noopAsync,
  omitAsyncReturnType,
  omitReturnType
} from './function.ts';

describe('Function', () => {
  describe('getFunctionExpressionString', () => {
    it('should return the string as-is for a function declaration', () => {
      function named(): void {
        noop();
      }
      expect(getFunctionExpressionString(named)).toBe(named.toString());
    });

    it('should return the string as-is for an arrow function', () => {
      // eslint-disable-next-line func-style -- Testing arrow function form.
      const arrow = (): void => {
        noop();
      };
      expect(getFunctionExpressionString(arrow)).toBe(arrow.toString());
    });

    it('should return the string as-is for an async function declaration', () => {
      async function asyncNamed(): Promise<void> {
        await noopAsync();
      }
      expect(getFunctionExpressionString(asyncNamed)).toBe(asyncNamed.toString());
    });

    it('should return the string as-is for an async arrow function', () => {
      // eslint-disable-next-line func-style -- Testing arrow function form.
      const asyncArrow = async (): Promise<void> => {
        await noopAsync();
      };
      expect(getFunctionExpressionString(asyncArrow)).toBe(asyncArrow.toString());
    });

    it('should return the string as-is for an async arrow function without space', () => {
      // eslint-disable-next-line func-style, @typescript-eslint/explicit-function-return-type -- Testing no-space async arrow form.
      const asyncArrow = async () => noopAsync();
      expect(getFunctionExpressionString(asyncArrow)).toBe(asyncArrow.toString());
    });

    it('should prefix with "function " for a shorthand method', () => {
      const obj = {
        method(this: void): void {
          noop();
        }
      };
      expect(getFunctionExpressionString(obj.method)).toMatch(/^function method\(\)/);
    });

    it('should prefix with "async function " for an async shorthand method', () => {
      const obj = {
        async method(this: void): Promise<void> {
          await noopAsync();
        }
      };
      expect(getFunctionExpressionString(obj.method)).toMatch(/^async function method\(\)/);
    });

    it('should prefix with "function " for a shorthand method named like "async1"', () => {
      const obj = {
        async1(this: void): void {
          noop();
        }
      };
      expect(getFunctionExpressionString(obj.async1)).toMatch(/^function async1\(\)/);
    });

    it('should prefix with "function " for a shorthand method named like "function1"', () => {
      const obj = {
        function1(this: void): void {
          noop();
        }
      };
      expect(getFunctionExpressionString(obj.function1)).toMatch(/^function function1\(\)/);
    });

    it('should prefix with "function " for a generator shorthand method', () => {
      const obj = {
        *gen(this: void): Generator<number, void> {
          yield 1;
        }
      };
      const result = getFunctionExpressionString(obj.gen);
      expect(result).toMatch(/^function \*gen\(\)/);
    });

    it('should prefix with "async function " for an async generator shorthand method', () => {
      const obj = {
        async *gen(this: void): AsyncGenerator<number, void> {
          await noopAsync();
          yield 1;
        }
      };
      const result = getFunctionExpressionString(obj.gen);
      expect(result).toMatch(/^async function \*gen\(\)/);
    });
  });

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
      const fn = vi.fn(async (_a: number) => {
        await noopAsync();
        return 'result';
      });
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
