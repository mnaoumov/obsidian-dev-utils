import type { Debouncer } from 'obsidian';

import {
  Component,
  debounce
} from 'obsidian';
import {
  describe,
  expect,
  expectTypeOf,
  it,
  vi
} from 'vitest';

import type { MaybeReturn } from '../../type.ts';
import type {
  FunctionKeys,
  MethodKeys,
  PatchHandlerFunction,
  PatchHandlerParams,
  PostPatchHandlerFunction,
  PostPatchHandlerParams
} from './monkey-around-component.ts';

import { noop } from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import {
  around,
  hasPatchToken,
  MonkeyAroundComponent
} from './monkey-around-component.ts';

interface MarkedGreet {
  marker: string;
}

interface RegisterDeferringPatchParams {
  readonly $object: TestObject;
  readonly component: MonkeyAroundComponent;
  readonly label: string;
  readonly patchToken: symbol;
}

interface TestObject {
  greet(name: string): string;
  sum(a: number, b: number): number;
  value: number;
}

type TestObjectGreet = TestObject['greet'];

function createTestObject(): TestObject {
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

/**
 * Registers the de-duplication pattern the token exists for: the patch labels the greeting, unless the
 * method it wrapped already carries the token — in which case an earlier copy of the same patch is
 * already live and this one defers to it.
 *
 * @param params - The parameters of the patch.
 */
function registerDeferringPatch(params: RegisterDeferringPatchParams): void {
  params.component.registerMethodPatch<TestObject, 'greet'>({
    $object: params.$object,
    methodName: 'greet',
    patchHandler: ({ fallback, originalMethod }) => {
      if (hasPatchToken(originalMethod, params.patchToken)) {
        return fallback();
      }

      return `${params.label}: ${fallback()}`;
    },
    patchToken: params.patchToken
  });
}

describe('around', () => {
  it('should patch a method on the object', () => {
    const $object = createTestObject();
    around($object, {
      greet: (next: TestObjectGreet) => (name: string): string => `patched: ${next(name)}`
    });
    expect($object.greet('world')).toBe('patched: hello world');
  });

  it('should return an uninstaller that restores the original method', () => {
    const $object = createTestObject();
    const uninstall = around($object, {
      greet: (next: TestObject['greet']) => (name: string): string => `patched: ${next(name)}`
    });
    expect($object.greet('a')).toBe('patched: hello a');
    uninstall();
    expect($object.greet('a')).toBe('hello a');
  });
});

describe('MonkeyAroundComponent', () => {
  describe('registerPatch', () => {
    it('should apply patch when loaded', () => {
      const $object = createTestObject();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch($object, {
        greet: (next: TestObjectGreet) => (name: string): string => `patched: ${next(name)}`
      });

      expect($object.greet('test')).toBe('patched: hello test');
    });

    it('should remove patch when unloaded', () => {
      const $object = createTestObject();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch($object, {
        greet: (next: TestObjectGreet) => (name: string): string => `patched: ${next(name)}`
      });

      expect($object.greet('x')).toBe('patched: hello x');
      component.unload();
      expect($object.greet('x')).toBe('hello x');
    });

    it('should be safe to unload twice', () => {
      const $object = createTestObject();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch($object, {
        greet: (next: TestObjectGreet) => (name: string): string => `patched: ${next(name)}`
      });

      component.unload();
      expect(() => {
        component.unload();
      }).not.toThrow();
    });

    it('should throw if registering patch before load', () => {
      const $object = createTestObject();
      const component = new MonkeyAroundComponent();

      expect(() => {
        component.registerPatch($object, {
          greet: (next: TestObjectGreet) => (name: string): string => `patched: ${next(name)}`
        });
      }).toThrow('Component is not loaded');
    });

    it('should manage multiple patches on a single component', () => {
      const object1 = createTestObject();
      const object2 = createTestObject();
      const component = new MonkeyAroundComponent();
      component.load();

      component.registerPatch(object1, {
        greet: (next: TestObjectGreet) => (name: string): string => `p1: ${next(name)}`
      });
      component.registerPatch(object2, {
        greet: (next: TestObjectGreet) => (name: string): string => `p2: ${next(name)}`
      });

      expect(object1.greet('a')).toBe('p1: hello a');
      expect(object2.greet('b')).toBe('p2: hello b');
      component.unload();
      expect(object1.greet('a')).toBe('hello a');
      expect(object2.greet('b')).toBe('hello b');
    });
  });

  describe('registerMethodPatch', () => {
    it('should throw if registering method patch before load', () => {
      const $object = createTestObject();
      const component = new MonkeyAroundComponent();

      expect(() => {
        component.registerMethodPatch<TestObject, 'greet'>({
          $object,
          methodName: 'greet',
          patchHandler: ({ fallback }) => {
            return fallback();
          }
        });
      }).toThrow('Component is not loaded');
    });

    it('should patch a method with handler receiving params', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => {
          return `method-patched: ${fallback()}`;
        }
      });

      expect($object.greet('world')).toBe('method-patched: hello world');
    });

    it('should remove method patch when unloaded', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => {
          return `method-patched: ${fallback()}`;
        }
      });

      expect($object.greet('x')).toBe('method-patched: hello x');
      component.unload();
      expect($object.greet('x')).toBe('hello x');
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
        $object: greeter,
        methodName: 'greet',
        patchHandler: ({ fallback }) => {
          return `patched(${fallback()})`;
        }
      });

      expect(greeter.greet('world')).toBe('patched(hi world)');
    });

    it('should work with a typed handler function', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      function handler({ originalArguments: [name], originalMethod, originalThis }: PatchHandlerParams<TestObject, 'greet'>): string {
        return `typed: ${originalMethod.call(originalThis, name)}`;
      }

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: handler
      });

      expect($object.greet('test')).toBe('typed: hello test');
    });

    it('should provide fallback that calls the original method', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => {
          const original = fallback();
          return `wrapped(${original})`;
        }
      });

      expect($object.greet('world')).toBe('wrapped(hello world)');
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
        $object: greeter,
        methodName: 'greet',
        patchHandler: ({ originalMethodBound }) => {
          return `bound(${originalMethodBound('test')})`;
        }
      });

      expect(greeter.greet('ignored')).toBe('bound(hi test)');
    });

    it('should support patchToken for identifying patches', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const token = Symbol('test-patch');

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => {
          return `patched: ${fallback()}`;
        },
        patchToken: token
      });

      expect($object.greet('world')).toBe('patched: hello world');
    });

    it('should be added as child of a parent Component', () => {
      const parent = new Component();
      parent.load();

      const $object = createTestObject();
      const component = parent.addChild(new MonkeyAroundComponent());

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => {
          return `child: ${fallback()}`;
        }
      });

      expect($object.greet('test')).toBe('child: hello test');
      parent.unload();
      expect($object.greet('test')).toBe('hello test');
    });

    it('should install the method returned by postPatchHandler in place of the patched method', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => `inner: ${fallback()}`,

        postPatchHandler: ({ patchedMethod }) => (name: string): string => `wrapped[${patchedMethod(name)}]`
      });

      expect($object.greet('world')).toBe('wrapped[inner: hello world]');
    });

    it('should fall back to the patched method when postPatchHandler returns nothing', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const originalGreet = $object.greet;
      let observedParams: PostPatchHandlerParams<TestObject, 'greet'> | undefined;

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => `inner: ${fallback()}`,
        postPatchHandler: (params) => {
          observedParams = params;
        }
      });

      expect($object.greet('world')).toBe('inner: hello world');
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
      const $object = createWithDebouncer(saved);

      component.registerFunctionPatch<WithDebouncer, 'save'>({
        $object,
        functionName: 'save',
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

      expect(typeof $object.save).toBe('function');
      expect(typeof $object.save.cancel).toBe('function');
    });
  });

  describe('registerFunctionPatch', () => {
    it('should throw if registering member patch before load', () => {
      const $object = createTestObject();
      const component = new MonkeyAroundComponent();

      expect(() => {
        component.registerFunctionPatch<TestObject, 'greet'>({
          $object,
          functionName: 'greet',
          patchHandler: (originalGreet) => originalGreet
        });
      }).toThrow('Component is not loaded');
    });

    it('should replace a member with the value returned by the patch handler', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerFunctionPatch<TestObject, 'greet'>({
        $object,
        functionName: 'greet',
        patchHandler: (originalGreet) => (name: string): string => `member: ${originalGreet(name)}`
      });

      expect($object.greet('world')).toBe('member: hello world');
    });

    it('should pass the original member value to the patch handler', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const originalGreet = $object.greet;
      let received: TestObject['greet'] | undefined;

      component.registerFunctionPatch<TestObject, 'greet'>({
        $object,
        functionName: 'greet',
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
      const $object = createTestObject();

      component.registerFunctionPatch<TestObject, 'greet'>({
        $object,
        functionName: 'greet',
        patchHandler: (originalGreet) => (name: string): string => `member: ${originalGreet(name)}`
      });

      expect($object.greet('x')).toBe('member: hello x');
      component.unload();
      expect($object.greet('x')).toBe('hello x');
    });
  });

  describe('once', () => {
    it('should intercept a method only on the first call, then restore the original', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      let callCount = 0;

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        once: true,
        patchHandler: ({ fallback }) => {
          callCount++;
          return `once: ${fallback()}`;
        }
      });

      expect($object.greet('a')).toBe('once: hello a');
      expect($object.greet('b')).toBe('hello b');
      expect(callCount).toBe(1);
    });

    it('should intercept a function member only on the first call, then restore the original', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      let callCount = 0;

      component.registerFunctionPatch<TestObject, 'greet'>({
        $object,
        functionName: 'greet',
        once: true,
        patchHandler: (originalGreet) => (name: string): string => {
          callCount++;
          return `once: ${originalGreet(name)}`;
        }
      });

      expect($object.greet('a')).toBe('once: hello a');
      expect($object.greet('b')).toBe('hello b');
      expect(callCount).toBe(1);
    });

    it('should unload the component after the first invocation of a once patch', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const unloadSpy = vi.spyOn(component, 'unload');

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        once: true,
        patchHandler: ({ fallback }) => fallback()
      });

      expect(unloadSpy).not.toHaveBeenCalled();
      $object.greet('a');
      expect(unloadSpy).toHaveBeenCalledTimes(1);
    });

    it('should preserve own members of a function-like patched value under once', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerFunctionPatch<TestObject, 'greet'>({
        $object,
        functionName: 'greet',
        once: true,
        patchHandler: (originalGreet) => {
          function patched(name: string): string {
            return `once: ${originalGreet(name)}`;
          }
          return Object.assign(patched, { marker: 'kept' });
        }
      });

      expect(castTo<MarkedGreet>($object.greet).marker).toBe('kept');
      expect($object.greet('a')).toBe('once: hello a');
    });
  });

  describe('hasPatchToken', () => {
    it('should return false for an unpatched function', () => {
      const token = Symbol('test-patch');

      expect(hasPatchToken(noop, token)).toBe(false);
    });

    it('should not detect its own token on the method it wrapped', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const token = Symbol('test-patch');
      let wasTokenDetected = false;

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback, originalMethod }) => {
          wasTokenDetected = hasPatchToken(originalMethod, token);
          return fallback();
        },
        patchToken: token
      });

      $object.greet('world');
      expect(wasTokenDetected).toBe(false);
    });

    it('should return false for a different token on the original method', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const token1 = Symbol('token-1');
      const token2 = Symbol('token-2');
      let wasTokenDetected = false;

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback, originalMethod }) => {
          wasTokenDetected = hasPatchToken(originalMethod, token2);
          return fallback();
        },
        patchToken: token1
      });

      $object.greet('world');
      expect(wasTokenDetected).toBe(false);
    });

    it('should allow a second independent patch to detect the first via Symbol.for', () => {
      const component1 = new MonkeyAroundComponent();
      component1.load();
      const component2 = new MonkeyAroundComponent();
      component2.load();
      const $object = createTestObject();
      let wasSecondPatchDetectedFirst = false;

      component1.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => fallback(),
        patchToken: Symbol.for('my-patch')
      });

      component2.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback, originalMethod }) => {
          wasSecondPatchDetectedFirst = hasPatchToken(originalMethod, Symbol.for('my-patch'));
          return fallback();
        },
        patchToken: Symbol.for('my-patch')
      });

      $object.greet('world');
      expect(wasSecondPatchDetectedFirst).toBe(true);
    });

    it('should track the token on the installed method, not on the one it wrapped', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const originalGreet = $object.greet;
      const token = Symbol('test-patch');

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => fallback(),
        patchToken: token
      });

      expect(hasPatchToken(originalGreet, token)).toBe(false);
      expect(hasPatchToken($object.greet, token)).toBe(true);
    });

    it('should track the token on the installed method of a `once` patch', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const token = Symbol('test-patch');

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        once: true,
        patchHandler: ({ fallback }) => `once: ${fallback()}`,
        patchToken: token
      });

      expect(hasPatchToken($object.greet, token)).toBe(true);
    });

    it('should drop the token when the patching component unloads', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();
      const token = Symbol('test-patch');

      component.registerMethodPatch<TestObject, 'greet'>({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => fallback(),
        patchToken: token
      });
      const patchedGreet = $object.greet;

      expect(hasPatchToken(patchedGreet, token)).toBe(true);

      component.unload();

      expect(hasPatchToken(patchedGreet, token)).toBe(false);
    });

    it('should keep only the first patch live when a later patch defers on the shared token', () => {
      const $object = createTestObject();
      const patchToken = Symbol.for('obsidian-dev-utils:deferring-patch');
      const component1 = new MonkeyAroundComponent();
      component1.load();
      const component2 = new MonkeyAroundComponent();
      component2.load();

      registerDeferringPatch({
        $object,
        component: component1,
        label: 'first',
        patchToken
      });
      registerDeferringPatch({
        $object,
        component: component2,
        label: 'second',
        patchToken
      });

      expect($object.greet('world')).toBe('first: hello world');
    });

    it('should let a later patch take over once the first patching component unloads', () => {
      const $object = createTestObject();
      const patchToken = Symbol.for('obsidian-dev-utils:deferring-patch');
      const component1 = new MonkeyAroundComponent();
      component1.load();
      const component2 = new MonkeyAroundComponent();
      component2.load();

      registerDeferringPatch({
        $object,
        component: component1,
        label: 'first',
        patchToken
      });
      registerDeferringPatch({
        $object,
        component: component2,
        label: 'second',
        patchToken
      });

      expect($object.greet('world')).toBe('first: hello world');

      component1.unload();

      expect($object.greet('world')).toBe('second: hello world');
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
      const $object = createTestObject();

      component.registerMethodPatch({
        $object,
        methodName: 'greet',
        patchHandler: ({ originalArguments: [name] }) => {
          expectTypeOf(name).toEqualTypeOf<string>();
          return name;
        }
      });
    });

    it('should narrow originalArgs for multi-param methods', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch({
        $object,
        methodName: 'sum',
        patchHandler: ({ fallback, originalArguments: [a, b] }) => {
          expectTypeOf(a).toEqualTypeOf<number>();
          expectTypeOf(b).toEqualTypeOf<number>();
          return fallback();
        }
      });
    });

    it('should narrow originalMethod to the exact method signature', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch({
        $object,
        methodName: 'greet',
        patchHandler: ({ originalMethod }) => {
          expectTypeOf(originalMethod).toEqualTypeOf<(name: string) => string>();
          return '';
        }
      });
    });

    it('should narrow originalMethodBound to the exact method signature', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch({
        $object,
        methodName: 'greet',
        patchHandler: ({ originalMethodBound }) => {
          expectTypeOf(originalMethodBound).toEqualTypeOf<(name: string) => string>();
          return '';
        }
      });
    });

    it('should narrow fallback return type to the method return type', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch({
        $object,
        methodName: 'greet',
        patchHandler: ({ fallback }) => {
          expectTypeOf(fallback).toEqualTypeOf<() => string>();
          return fallback();
        }
      });
    });

    it('should narrow originalThis to the object type', () => {
      const component = new MonkeyAroundComponent();
      component.load();
      const $object = createTestObject();

      component.registerMethodPatch({
        $object,
        methodName: 'greet',
        patchHandler: ({ originalThis }) => {
          expectTypeOf(originalThis).toEqualTypeOf<TestObject>();
          return '';
        }
      });
    });

    it('should correctly type PatchHandlerFn', () => {
      expectTypeOf<PatchHandlerFunction<TestObject, 'greet'>>()
        .toEqualTypeOf<(params: PatchHandlerParams<TestObject, 'greet'>) => string>();
    });

    it('should correctly type PostPatchHandlerFn', () => {
      expectTypeOf<PostPatchHandlerFunction<TestObject, 'greet'>>()
        .toEqualTypeOf<(params: PostPatchHandlerParams<TestObject, 'greet'>) => MaybeReturn<(name: string) => string>>();
    });
  });
});
