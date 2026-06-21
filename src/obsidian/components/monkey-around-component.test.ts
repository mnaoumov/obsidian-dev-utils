import type { Debouncer } from 'obsidian';

import {
  Component,
  debounce
} from 'obsidian';
import {
  describe,
  expect,
  expectTypeOf,
  it
} from 'vitest';

import type { MaybeReturn } from '../../type.ts';
import type {
  FunctionKeys,
  MethodKeys,
  PatchHandlerFn,
  PatchHandlerParams,
  PostPatchHandlerFn,
  PostPatchHandlerParams
} from './monkey-around-component.ts';

import { noop } from '../../function.ts';
import {
  around,
  hasPatchToken,
  MonkeyAroundComponent
} from './monkey-around-component.ts';

interface TestObj {
  greet(name: string): string;
  sum(a: number, b: number): number;
  value: number;
}

type TestObjGreet = TestObj['greet'];

function createTestObj(): TestObj {
  return {
    greet(name: string): string {
      return `hello ${name}`;
    },
    sum(a: number, b: number): number {
      return a + b;
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

describe('MonkeyAroundComponent', () => {
  describe('registerPatch', () => {
    it('should apply patch when loaded', () => {
      const obj = createTestObj();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch(obj, {
        greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
      });

      expect(obj.greet('test')).toBe('patched: hello test');
    });

    it('should remove patch when unloaded', () => {
      const obj = createTestObj();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch(obj, {
        greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
      });

      expect(obj.greet('x')).toBe('patched: hello x');
      component.unload();
      expect(obj.greet('x')).toBe('hello x');
    });

    it('should be safe to unload twice', () => {
      const obj = createTestObj();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch(obj, {
        greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
      });

      component.unload();
      expect(() => {
        component.unload();
      }).not.toThrow();
    });

    it('should throw if registering patch before load', () => {
      const obj = createTestObj();
      const component = new MonkeyAroundComponent();

      expect(() => {
        component.registerPatch(obj, {
          greet: (next: TestObjGreet) => (name: string): string => `patched: ${next(name)}`
        });
      }).toThrow('Component is not loaded');
    });

    it('should manage multiple patches on a single component', () => {
      const obj1 = createTestObj();
      const obj2 = createTestObj();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch(obj1, {
        greet: (next: TestObjGreet) => (name: string): string => `p1: ${next(name)}`
      });
      component.registerPatch(obj2, {
        greet: (next: TestObjGreet) => (name: string): string => `p2: ${next(name)}`
      });

      expect(obj1.greet('a')).toBe('p1: hello a');
      expect(obj2.greet('b')).toBe('p2: hello b');
      component.unload();
      expect(obj1.greet('a')).toBe('hello a');
      expect(obj2.greet('b')).toBe('hello b');
    });
  });

  describe('registerMethodPatch', () => {
    it('should throw if registering method patch before load', () => {
      const obj = createTestObj();
      const component = new MonkeyAroundComponent();

      expect(() => {
        component.registerMethodPatch<TestObj, 'greet'>({
          methodName: 'greet',
          obj,
          patchHandler: ({ fallback }) => {
            return fallback();
          }
        });
      }).toThrow('Component is not loaded');
    });

    it('should patch a method with handler receiving params', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => {
          return `method-patched: ${fallback()}`;
        }
      });

      expect(obj.greet('world')).toBe('method-patched: hello world');
    });

    it('should remove method patch when unloaded', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => {
          return `method-patched: ${fallback()}`;
        }
      });

      expect(obj.greet('x')).toBe('method-patched: hello x');
      component.unload();
      expect(obj.greet('x')).toBe('hello x');
    });

    it('should preserve originalThis for prototype patches', () => {
      class Greeter {
        public prefix = 'hi';

        public greet(name: string): string {
          return `${this.prefix} ${name}`;
        }
      }
      const greeter = new Greeter();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerMethodPatch<Greeter, 'greet'>({
        methodName: 'greet',
        obj: greeter,
        patchHandler: ({ fallback }) => {
          return `patched(${fallback()})`;
        }
      });

      expect(greeter.greet('world')).toBe('patched(hi world)');
    });

    it('should work with a typed handler function', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      function handler({ originalArgs: [name], originalMethod, originalThis }: PatchHandlerParams<TestObj, 'greet'>): string {
        return `typed: ${originalMethod.call(originalThis, name)}`;
      }

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: handler
      });

      expect(obj.greet('test')).toBe('typed: hello test');
    });

    it('should provide fallback that calls the original method', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => {
          const original = fallback();
          return `wrapped(${original})`;
        }
      });

      expect(obj.greet('world')).toBe('wrapped(hello world)');
    });

    it('should provide originalMethodBound that calls original with correct this', () => {
      class Greeter {
        public prefix = 'hi';

        public greet(name: string): string {
          return `${this.prefix} ${name}`;
        }
      }
      const greeter = new Greeter();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerMethodPatch<Greeter, 'greet'>({
        methodName: 'greet',
        obj: greeter,
        patchHandler: ({ originalMethodBound }) => {
          return `bound(${originalMethodBound('test')})`;
        }
      });

      expect(greeter.greet('ignored')).toBe('bound(hi test)');
    });

    it('should support patchToken for identifying patches', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();
      const token = Symbol('test-patch');

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => {
          return `patched: ${fallback()}`;
        },
        patchToken: token
      });

      expect(obj.greet('world')).toBe('patched: hello world');
    });

    it('should be added as child of a parent Component', () => {
      const parent = new Component();
      parent.load();

      const obj = createTestObj();
      const component = parent.addChild(new MonkeyAroundComponent());

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => {
          return `child: ${fallback()}`;
        }
      });

      expect(obj.greet('test')).toBe('child: hello test');
      parent.unload();
      expect(obj.greet('test')).toBe('hello test');
    });

    it('should install the method returned by postPatchHandler in place of the patched method', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => `inner: ${fallback()}`,

        postPatchHandler: ({ patchedMethod }) => (name: string): string => `wrapped[${patchedMethod(name)}]`
      });

      expect(obj.greet('world')).toBe('wrapped[inner: hello world]');
    });

    it('should fall back to the patched method when postPatchHandler returns nothing', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();
      const originalGreet = obj.greet;
      let observedParams: PostPatchHandlerParams<TestObj, 'greet'> | undefined;

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => `inner: ${fallback()}`,
        postPatchHandler: (params) => {
          observedParams = params;
        }
      });

      expect(obj.greet('world')).toBe('inner: hello world');
      expect(observedParams?.originalMethod).toBe(originalGreet);
      expect(observedParams?.patchedMethod('test')).toBe('inner: hello test');
    });
  });

  describe('Debouncer members', () => {
    interface WithDebouncer {
      save: Debouncer<[string], void>;
    }

    function createWithDebouncer(saved: string[]): WithDebouncer {
      return {
        save: debounce(
          (value: string) => {
            saved.push(value);
          },
          0,
          true
        )
      };
    }

    it('registerFunctionPatch should expose the full Debouncer type and allow replacing it', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const saved: string[] = [];
      const obj = createWithDebouncer(saved);

      component.registerFunctionPatch<WithDebouncer, 'save'>({
        functionName: 'save',
        obj,
        patchHandler: (originalValue) => {
          expectTypeOf(originalValue).toEqualTypeOf<Debouncer<[string], void>>();
          return debounce(
            (value: string) => {
              saved.push(`new:${value}`);
            },
            0,
            true
          );
        }
      });

      expect(typeof obj.save).toBe('function');
      expect(typeof obj.save.cancel).toBe('function');
    });
  });

  describe('registerFunctionPatch', () => {
    it('should throw if registering member patch before load', () => {
      const obj = createTestObj();
      const component = new MonkeyAroundComponent();

      expect(() => {
        component.registerFunctionPatch<TestObj, 'greet'>({
          functionName: 'greet',
          obj,
          patchHandler: (originalGreet) => originalGreet
        });
      }).toThrow('Component is not loaded');
    });

    it('should replace a member with the value returned by the patch handler', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerFunctionPatch<TestObj, 'greet'>({
        functionName: 'greet',
        obj,
        patchHandler: (originalGreet) => (name: string): string => `member: ${originalGreet(name)}`
      });

      expect(obj.greet('world')).toBe('member: hello world');
    });

    it('should pass the original member value to the patch handler', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();
      const originalGreet = obj.greet;
      let received: TestObj['greet'] | undefined;

      component.registerFunctionPatch<TestObj, 'greet'>({
        functionName: 'greet',
        obj,
        patchHandler: (originalValue) => {
          received = originalValue;
          return (name: string): string => originalValue(name);
        }
      });

      expect(received).toBe(originalGreet);
    });

    it('should remove the member patch when unloaded', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerFunctionPatch<TestObj, 'greet'>({
        functionName: 'greet',
        obj,
        patchHandler: (originalGreet) => (name: string): string => `member: ${originalGreet(name)}`
      });

      expect(obj.greet('x')).toBe('member: hello x');
      component.unload();
      expect(obj.greet('x')).toBe('hello x');
    });
  });

  describe('hasPatchToken', () => {
    it('should return false for an unpatched function', () => {
      const token = Symbol('test-patch');

      expect(hasPatchToken(noop, token)).toBe(false);
    });

    it('should return true when checking the original method inside the handler', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();
      const token = Symbol('test-patch');
      let detectedToken = false;

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback, originalMethod }) => {
          detectedToken = hasPatchToken(originalMethod, token);
          return fallback();
        },
        patchToken: token
      });

      obj.greet('world');
      expect(detectedToken).toBe(true);
    });

    it('should return false for a different token on the original method', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();
      const token1 = Symbol('token-1');
      const token2 = Symbol('token-2');
      let detectedToken = false;

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback, originalMethod }) => {
          detectedToken = hasPatchToken(originalMethod, token2);
          return fallback();
        },
        patchToken: token1
      });

      obj.greet('world');
      expect(detectedToken).toBe(false);
    });

    it('should allow a second independent patch to detect the first via Symbol.for', () => {
      const component1 = new MonkeyAroundComponent();
      component1.load();
      const component2 = new MonkeyAroundComponent();
      component2.load();
      const obj = createTestObj();
      let secondPatchDetectedFirst = false;

      component1.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => fallback(),
        patchToken: Symbol.for('my-patch')
      });

      component2.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback, originalMethod }) => {
          secondPatchDetectedFirst = hasPatchToken(originalMethod, Symbol.for('my-patch'));
          return fallback();
        },
        patchToken: Symbol.for('my-patch')
      });

      obj.greet('world');
      expect(secondPatchDetectedFirst).toBe(true);
    });

    it('should track token on the original function, not the wrapped one', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();
      const originalGreet = obj.greet;
      const token = Symbol('test-patch');

      component.registerMethodPatch<TestObj, 'greet'>({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => fallback(),
        patchToken: token
      });

      expect(hasPatchToken(originalGreet, token)).toBe(true);
      expect(hasPatchToken(obj.greet, token)).toBe(false);
    });
  });

  describe('FunctionKeys / MethodKeys', () => {
    interface Mixed {
      greet(name: string): string;
      save: Debouncer<[string], void>;
      sum(a: number, b: number): number;
      value: number;
    }

    interface OnlyDebouncer {
      save: Debouncer<[string], void>;
    }

    it('FunctionKeys includes methods and callable objects (Debouncer), excluding non-callables', () => {
      expectTypeOf<FunctionKeys<Mixed>>().toEqualTypeOf<'greet' | 'save' | 'sum'>();
    });

    it('MethodKeys includes only plain methods, excluding Debouncer and non-callables', () => {
      expectTypeOf<MethodKeys<Mixed>>().toEqualTypeOf<'greet' | 'sum'>();
    });

    it('MethodKeys is never when the object has only a Debouncer member', () => {
      expectTypeOf<MethodKeys<OnlyDebouncer>>().toBeNever();
    });
  });

  describe('registerMethodPatch type inference', () => {
    it('should narrow originalArgs to the method parameter types', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch({
        methodName: 'greet',
        obj,
        patchHandler: ({ originalArgs: [name] }) => {
          expectTypeOf(name).toEqualTypeOf<string>();
          return name;
        }
      });
    });

    it('should narrow originalArgs for multi-param methods', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch({
        methodName: 'sum',
        obj,
        patchHandler: ({ fallback, originalArgs: [a, b] }) => {
          expectTypeOf(a).toEqualTypeOf<number>();
          expectTypeOf(b).toEqualTypeOf<number>();
          return fallback();
        }
      });
    });

    it('should narrow originalMethod to the exact method signature', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch({
        methodName: 'greet',
        obj,
        patchHandler: ({ originalMethod }) => {
          expectTypeOf(originalMethod).toEqualTypeOf<(name: string) => string>();
          return '';
        }
      });
    });

    it('should narrow originalMethodBound to the exact method signature', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch({
        methodName: 'greet',
        obj,
        patchHandler: ({ originalMethodBound }) => {
          expectTypeOf(originalMethodBound).toEqualTypeOf<(name: string) => string>();
          return '';
        }
      });
    });

    it('should narrow fallback return type to the method return type', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch({
        methodName: 'greet',
        obj,
        patchHandler: ({ fallback }) => {
          expectTypeOf(fallback).toEqualTypeOf<() => string>();
          return fallback();
        }
      });
    });

    it('should narrow originalThis to the object type', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const obj = createTestObj();

      component.registerMethodPatch({
        methodName: 'greet',
        obj,
        patchHandler: ({ originalThis }) => {
          expectTypeOf(originalThis).toEqualTypeOf<TestObj>();
          return '';
        }
      });
    });

    it('should correctly type PatchHandlerFn', () => {
      expectTypeOf<PatchHandlerFn<TestObj, 'greet'>>()
        .toEqualTypeOf<(params: PatchHandlerParams<TestObj, 'greet'>) => string>();
    });

    it('should correctly type PostPatchHandlerFn', () => {
      expectTypeOf<PostPatchHandlerFn<TestObj, 'greet'>>()
        .toEqualTypeOf<(params: PostPatchHandlerParams<TestObj, 'greet'>) => MaybeReturn<(name: string) => string>>();
    });
  });
});
