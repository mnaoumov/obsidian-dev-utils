import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  cloneFunction,
  createFunction,
  getFunctionExpressionString,
  noop,
  noopAsync,
  omitAsyncReturnType,
  omitReturnType
} from './function.ts';

interface ValueHolder {
  value: number;
}

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
      const $object = {
        method(this: void): void {
          noop();
        }
      };
      expect(getFunctionExpressionString($object.method)).toMatch(/^function method\(\)/);
    });

    it('should prefix with "async function " for an async shorthand method', () => {
      const $object = {
        async method(this: void): Promise<void> {
          await noopAsync();
        }
      };
      expect(getFunctionExpressionString($object.method)).toMatch(/^async function method\(\)/);
    });

    it('should prefix with "function " for a shorthand method named like "async1"', () => {
      const $object = {
        async1(this: void): void {
          noop();
        }
      };
      expect(getFunctionExpressionString($object.async1)).toMatch(/^function async1\(\)/);
    });

    it('should prefix with "function " for a shorthand method named like "function1"', () => {
      const $object = {
        function1(this: void): void {
          noop();
        }
      };
      expect(getFunctionExpressionString($object.function1)).toMatch(/^function function1\(\)/);
    });

    it('should prefix with "function " for a generator shorthand method', () => {
      const $object = {
        *gen(this: void): Generator<number, void> {
          yield 1;
        }
      };
      const result = getFunctionExpressionString($object.gen);
      expect(result).toMatch(/^function \*gen\(\)/);
    });

    it('should prefix with "async function " for an async generator shorthand method', () => {
      const $object = {
        async *gen(this: void): AsyncGenerator<number, void> {
          await noopAsync();
          yield 1;
        }
      };
      const result = getFunctionExpressionString($object.gen);
      expect(result).toMatch(/^async function \*gen\(\)/);
    });
  });

  describe('cloneFunction', () => {
    it('should return a new function that is not strictly equal to the original', () => {
      function original(): number {
        return 42;
      }
      const cloned = cloneFunction(original);
      expect(cloned).not.toBe(original);
    });

    it('should preserve the original behavior and forward typed arguments', () => {
      function add(a: number, b: number): number {
        return a + b;
      }
      const cloned = cloneFunction(add);
      expect(cloned(2, 3)).toBe(5);
    });

    it('should forward the `this` context to the original function', () => {
      const $object = {
        getValue(this: ValueHolder): number {
          return this.value;
        },
        value: 10
      };
      $object.getValue = cloneFunction($object.getValue);
      expect($object.getValue()).toBe(10);
    });
  });

  describe('createFunction', () => {
    it('should create an argumentless function from the function body', () => {
      const $function = createFunction<() => number>({ functionBody: 'return 42;' });
      expect($function()).toBe(42);
    });

    it('should create a function with named arguments', () => {
      const $function = createFunction<(a: number, b: number) => number>({
        argumentNames: ['a', 'b'],
        functionBody: 'return a + b;'
      });
      expect($function(2, 3)).toBe(5);
    });

    it('should default to no arguments when argNames is omitted', () => {
      const $function = createFunction<() => string>({ functionBody: 'return "no args";' });
      expect($function()).toBe('no args');
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
      const $function = vi.fn((_a: number, _b: string) => 42);
      const wrapped = omitReturnType($function);
      wrapped(1, 'hello');
      expect($function).toHaveBeenCalledWith(1, 'hello');
    });

    it('should return undefined regardless of original return value', () => {
      function $function(): number {
        return 42;
      }
      const wrapped = omitReturnType($function);
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Need to test `void` as `undefined`.
      expect(wrapped()).toBeUndefined();
    });

    it('should propagate thrown errors', () => {
      function $function(): never {
        throw new Error('test');
      }
      const wrapped = omitReturnType($function);
      expect(() => {
        wrapped();
      }).toThrow('test');
    });
  });

  describe('omitAsyncReturnType', () => {
    it('should call the wrapped async function with correct arguments', async () => {
      const $function = vi.fn(async (_a: number) => {
        await noopAsync();
        return 'result';
      });
      const wrapped = omitAsyncReturnType($function);
      await wrapped(5);
      expect($function).toHaveBeenCalledWith(5);
    });

    it('should return a resolved promise with undefined', async () => {
      async function $function(): Promise<number> {
        await noopAsync();
        return 42;
      }
      const wrapped = omitAsyncReturnType($function);
      await expect(wrapped()).resolves.toBeUndefined();
    });

    it('should propagate rejected promises', async () => {
      async function $function(): Promise<never> {
        await noopAsync();
        throw new Error('async error');
      }
      const wrapped = omitAsyncReturnType($function);
      await expect(wrapped()).rejects.toThrow('async error');
    });
  });
});
