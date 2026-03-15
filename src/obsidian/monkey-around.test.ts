import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { createMockOf } from '../test-helpers/mock-implementation.ts';
import {
  around,
  invokeWithPatch,
  invokeWithPatchAsync,
  registerPatch
} from './monkey-around.ts';

interface TestObj {
  greet(name: string): string;
  value: number;
}

type TestObjGreet = TestObj['greet'];

function createTestObj(): TestObj {
  return {
    greet(name: string): string {
      return `hello ${name}`;
    },
    value: 42
  };
}

describe('around', () => {
  it('should patch a method on the object', () => {
    const obj = createTestObj();
    around(obj, {
      greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
    });
    expect(obj.greet('world')).toBe('patched: hello world');
  });

  it('should return an uninstaller that restores the original method', () => {
    const obj = createTestObj();
    const uninstall = around(obj, {
      greet: (next: TestObj['greet']) => (name: string): string => `patched: ${next(name)}`
    });
    expect(obj.greet('a')).toBe('patched: hello a');
    uninstall();
    expect(obj.greet('a')).toBe('hello a');
  });
});

describe('invokeWithPatch', () => {
  it('should apply patch during function execution', () => {
    const obj = createTestObj();
    const result = invokeWithPatch(
      obj,
      { greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}` },
      () => obj.greet('test')
    );
    expect(result).toBe('patched: hello test');
  });

  it('should remove patch after function returns', () => {
    const obj = createTestObj();
    invokeWithPatch(
      obj,
      { greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}` },
      () => obj.greet('test')
    );
    expect(obj.greet('test')).toBe('hello test');
  });

  it('should remove patch even if function throws', () => {
    const obj = createTestObj();
    expect(() =>
      invokeWithPatch(
        obj,
        { greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}` },
        (): never => {
          throw new Error('boom');
        }
      )
    ).toThrow('boom');
    expect(obj.greet('test')).toBe('hello test');
  });
});

describe('invokeWithPatchAsync', () => {
  it('should apply patch during async function execution', async () => {
    const obj = createTestObj();
    const result = await invokeWithPatchAsync(
      obj,
      { greet: (next: TestObjGreet) => (name: string): string => `async: ${next(name)}` },
      async () => obj.greet('test')
    );
    expect(result).toBe('async: hello test');
  });

  it('should remove patch after async function resolves', async () => {
    const obj = createTestObj();
    await invokeWithPatchAsync(
      obj,
      { greet: (next: TestObjGreet) => (name: string): string => `async: ${next(name)}` },
      async () => obj.greet('test')
    );
    expect(obj.greet('test')).toBe('hello test');
  });

  it('should remove patch even if async function rejects', async () => {
    const obj = createTestObj();
    await expect(invokeWithPatchAsync(
      obj,
      { greet: (next: TestObjGreet) => (name: string): string => `async: ${next(name)}` },
      async (): Promise<never> => {
        throw new Error('async boom');
      }
    )).rejects.toThrow('async boom');
    expect(obj.greet('test')).toBe('hello test');
  });
});

describe('registerPatch', () => {
  it('should apply patch and register uninstaller on component', () => {
    const obj = createTestObj();
    const registerFn = vi.fn();
    const component = createMockOf<import('obsidian').Component>({ register: registerFn });
    registerPatch(component, obj, {
      greet: (next: TestObjGreet) => (name: string): string => `registered: ${next(name)}`
    });
    expect(obj.greet('test')).toBe('registered: hello test');
    expect(registerFn).toHaveBeenCalledTimes(1);
  });

  it('should uninstall patch when component uninstaller is called', () => {
    const obj = createTestObj();
    let registeredFn: (() => void) | undefined;
    const component = createMockOf<import('obsidian').Component>({
      register: (fn: () => void): void => {
        registeredFn = fn;
      }
    });
    registerPatch(component, obj, {
      greet: (next: TestObjGreet) => (name: string): string => `registered: ${next(name)}`
    });
    expect(obj.greet('x')).toBe('registered: hello x');
    registeredFn?.();
    expect(obj.greet('x')).toBe('hello x');
  });

  it('should be safe to call uninstaller wrapper twice', () => {
    const obj = createTestObj();
    let registeredFn: (() => void) | undefined;
    const component = createMockOf<import('obsidian').Component>({
      register: (fn: () => void): void => {
        registeredFn = fn;
      }
    });
    registerPatch(component, obj, {
      greet: (next: TestObjGreet) => (name: string): string => `registered: ${next(name)}`
    });
    registeredFn?.();
    expect(() => registeredFn?.()).not.toThrow();
  });
});
