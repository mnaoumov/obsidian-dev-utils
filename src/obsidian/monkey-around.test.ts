import { Component } from 'obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { noopAsync } from '../function.ts';
import {
  around,
  invokeWithPatch,
  invokeWithPatchAsync,
  PatchComponent,
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
      async () => {
        await noopAsync();
        return obj.greet('test');
      }
    );
    expect(result).toBe('async: hello test');
  });

  it('should remove patch after async function resolves', async () => {
    const obj = createTestObj();
    await invokeWithPatchAsync(
      obj,
      { greet: (next: TestObjGreet) => (name: string): string => `async: ${next(name)}` },
      async () => {
        await noopAsync();
        return obj.greet('test');
      }
    );
    expect(obj.greet('test')).toBe('hello test');
  });

  it('should remove patch even if async function rejects', async () => {
    const obj = createTestObj();
    await expect(invokeWithPatchAsync(
      obj,
      { greet: (next: TestObjGreet) => (name: string): string => `async: ${next(name)}` },
      async (): Promise<never> => {
        await noopAsync();
        throw new Error('async boom');
      }
    )).rejects.toThrow('async boom');
    expect(obj.greet('test')).toBe('hello test');
  });
});

describe('PatchComponent', () => {
  it('should apply patch when loaded', () => {
    const obj = createTestObj();
    const patchComponent = new PatchComponent(obj, {
      greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
    });

    expect(obj.greet('test')).toBe('hello test');
    patchComponent.load();
    expect(obj.greet('test')).toBe('patched: hello test');
  });

  it('should remove patch when unloaded', () => {
    const obj = createTestObj();
    const patchComponent = new PatchComponent(obj, {
      greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
    });

    patchComponent.load();
    expect(obj.greet('x')).toBe('patched: hello x');
    patchComponent.unload();
    expect(obj.greet('x')).toBe('hello x');
  });

  it('should be safe to unload twice', () => {
    const obj = createTestObj();
    const patchComponent = new PatchComponent(obj, {
      greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
    });

    patchComponent.load();
    patchComponent.unload();
    expect(() => {
      patchComponent.unload();
    }).not.toThrow();
  });
});

describe('registerPatch', () => {
  it('should apply patch and add child component', () => {
    const obj = createTestObj();
    const parent = new Component();
    parent.load();

    const patchComponent = registerPatch(parent, obj, {
      greet: (next: TestObjGreet) => (name: string): string => `registered: ${next(name)}`
    });

    expect(patchComponent).toBeInstanceOf(PatchComponent);
    expect(obj.greet('test')).toBe('registered: hello test');
  });

  it('should remove patch when parent component is unloaded', () => {
    const obj = createTestObj();
    const parent = new Component();
    parent.load();

    registerPatch(parent, obj, {
      greet: (next: TestObjGreet) => (name: string): string => `registered: ${next(name)}`
    });

    expect(obj.greet('x')).toBe('registered: hello x');
    parent.unload();
    expect(obj.greet('x')).toBe('hello x');
  });
});
