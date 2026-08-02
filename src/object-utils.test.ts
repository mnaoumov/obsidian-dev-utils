import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from './type-guards.ts';

import { noop } from './function.ts';
import {
  assignWithNonEnumerableProperties,
  castTo,
  cloneWithNonEnumerableProperties,
  deepEqual,
  deleteProperties,
  deleteProperty,
  extractDefaultExportInterop,
  FunctionHandlingMode,
  getAllEntries,
  getAllKeys,
  getNestedPropertyValue,
  getPrototypeOf,
  nameof,
  normalizeOptionalProperties,
  removeUndefinedProperties,
  setNestedPropertyValue,
  toJson
} from './object-utils.ts';
import {
  assertNonNullable,
  ensureGenericObject
} from './type-guards.ts';

interface NormalizeTestObject {
  a: number;
  b?: number;
}

interface RemoveUndefinedTestObject {
  a: number;
  b?: undefined;
  c: string;
}

describe('ObjectUtils', () => {
  describe('deepEqual', () => {
    it('should return true for identical references', () => {
      const $object = { a: 1 };
      expect(deepEqual($object, $object)).toBe(true);
    });

    it.each([
      [1, 1],
      ['hello', 'hello'],
      [true, true],
      [null, null],
      [undefined, undefined]
    ])('should return true for equal primitives %j and %j', (a, b) => {
      expect(deepEqual(a, b)).toBe(true);
    });

    it.each([
      [1, 2],
      ['a', 'b'],
      [true, false],
      [null, undefined]
    ])('should return false for different primitives %j and %j', (a, b) => {
      expect(deepEqual(a, b)).toBe(false);
    });

    it.each([
      [{ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }, true],
      [{ a: 1 }, { a: 2 }, false],
      [{ a: 1 }, { a: 1, b: 2 }, false]
    ])('should compare plain objects deeply %j and %j → %j', (a, b, expected) => {
      expect(deepEqual(a, b)).toBe(expected);
    });

    it.each([
      [[1, 2, 3], [1, 2, 3], true],
      [[1, 2], [1, 2, 3], false],
      [[1, [2, 3]], [1, [2, 3]], true]
    ])('should compare arrays deeply %j and %j → %j', (a, b, expected) => {
      expect(deepEqual(a, b)).toBe(expected);
    });

    it.each([
      ['2024-01-01', '2024-01-01', true],
      ['2024-01-01', '2024-01-02', false]
    ])('should compare Dates %s and %s → %j', (a, b, expected) => {
      expect(deepEqual(new Date(a), new Date(b))).toBe(expected);
    });

    it.each([
      [/abc/gi, /abc/gi, true],
      [/abc/g, /abc/i, false],
      [/abc/, /def/, false]
    ])('should compare RegExps %j and %j → %j', (a, b, expected) => {
      expect(deepEqual(a, b)).toBe(expected);
    });

    it('should return true for equal Maps', () => {
      const m1 = new Map([['a', 1], ['b', 2]]);
      const m2 = new Map([['a', 1], ['b', 2]]);
      expect(deepEqual(m1, m2)).toBe(true);
    });

    it('should return false for Maps with different sizes', () => {
      const m1 = new Map([['a', 1], ['b', 2]]);
      const m3 = new Map([['a', 1]]);
      expect(deepEqual(m1, m3)).toBe(false);
    });

    it('should return true for equal Sets', () => {
      const s1 = new Set([1, 2, 3]);
      const s2 = new Set([1, 2, 3]);
      expect(deepEqual(s1, s2)).toBe(true);
    });

    it('should return false for Sets with different sizes', () => {
      const s1 = new Set([1, 2, 3]);
      const s3 = new Set([1, 2]);
      expect(deepEqual(s1, s3)).toBe(false);
    });

    it('should compare Sets with deep objects', () => {
      const s1 = new Set([{ a: 1 }]);
      const s2 = new Set([{ a: 1 }]);
      expect(deepEqual(s1, s2)).toBe(true);
    });

    it('should return false for Sets with different deep objects', () => {
      const s1 = new Set([{ a: 1 }, { b: 2 }]);
      const s2 = new Set([{ a: 1 }, { b: 99 }]);
      expect(deepEqual(s1, s2)).toBe(false);
    });

    it('should compare Maps with different values for same key', () => {
      const m1 = new Map([['a', 1]]);
      const m2 = new Map([['a', 2]]);
      expect(deepEqual(m1, m2)).toBe(false);
    });

    it('should compare ArrayBuffers of different lengths', () => {
      const a1 = new Uint8Array([1, 2]).buffer;
      const a2 = new Uint8Array([1, 2, 3]).buffer;
      expect(deepEqual(a1, a2)).toBe(false);
    });

    it('should return true for equal ArrayBuffers', () => {
      const a1 = new Uint8Array([1, 2, 3]).buffer;
      const a2 = new Uint8Array([1, 2, 3]).buffer;
      expect(deepEqual(a1, a2)).toBe(true);
    });

    it('should return false for ArrayBuffers with different contents', () => {
      const a1 = new Uint8Array([1, 2, 3]).buffer;
      const a3 = new Uint8Array([1, 2, 4]).buffer;
      expect(deepEqual(a1, a3)).toBe(false);
    });

    it('should return false for different constructors', () => {
      class A {
        public x = 1;
      }
      class B {
        public x = 1;
      }
      expect(deepEqual(new A(), new B())).toBe(false);
    });

    it.each([
      [{}, null],
      [null, {}]
    ])('should return false for object vs null %j and %j', (a, b) => {
      expect(deepEqual(a, b)).toBe(false);
    });
  });

  describe('getAllKeys', () => {
    it('should get enumerable writable keys', () => {
      const $object = { a: 1, b: 'hello' };
      expect(getAllKeys($object)).toEqual(['a', 'b']);
    });

    it('should return sorted keys', () => {
      const $object = { a: 2, m: 3, z: 1 };
      expect(getAllKeys($object)).toEqual(['a', 'm', 'z']);
    });

    it('should skip function values', () => {
      const $object = { a: 1, fn: noop };
      expect(getAllKeys($object)).toEqual(['a']);
    });

    it('should skip __proto__', () => {
      const $object = ensureGenericObject(Object.create(null));
      // eslint-disable-next-line no-proto -- Testing `__proto__`.
      $object['__proto__'] = 'test';
      $object['a'] = 1;
      expect(getAllKeys($object)).toContain('a');
    });
  });

  describe('getAllEntries', () => {
    it('should return key-value pairs', () => {
      const $object = { a: 1, b: 'two' };
      const entries = getAllEntries($object);
      expect(entries).toEqual([['a', 1], ['b', 'two']]);
    });
  });

  describe('getNestedPropertyValue', () => {
    it('should get a top-level property', () => {
      expect(getNestedPropertyValue({ a: 1 }, 'a')).toBe(1);
    });

    it('should get a nested property', () => {
      expect(getNestedPropertyValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    it('should return undefined for missing path', () => {
      expect(getNestedPropertyValue({ a: 1 }, 'a.b.c')).toBeUndefined();
    });
  });

  describe('setNestedPropertyValue', () => {
    it('should set a top-level property', () => {
      const $object: GenericObject = { a: 1 };
      setNestedPropertyValue({
        obj: $object,
        path: 'a',
        value: 2
      });
      expect($object['a']).toBe(2);
    });

    it('should set a nested property', () => {
      const $object = { a: { b: { c: 1 } } };
      setNestedPropertyValue({
        obj: ensureGenericObject($object),
        path: 'a.b.c',
        value: 42
      });
      expect($object.a.b.c).toBe(42);
    });

    it('should throw for missing intermediate path', () => {
      const $object: GenericObject = { a: 1 };
      expect(() => {
        setNestedPropertyValue({
          obj: $object,
          path: 'x.y.z',
          value: 42
        });
      }).toThrow('Property path x.y.z not found');
    });

    it('should throw when last intermediate resolves to undefined', () => {
      const $object: GenericObject = { a: undefined };
      expect(() => {
        setNestedPropertyValue({
          obj: $object,
          path: 'a.b',
          value: 42
        });
      }).toThrow('Property path a.b not found');
    });
  });

  describe('deleteProperty', () => {
    it('should return true when deleting an existing property', () => {
      const $object = { a: 1, b: 2 };
      expect(deleteProperty($object, 'a')).toBe(true);
    });

    it('should remove the property from the object', () => {
      const $object = { a: 1, b: 2 };
      deleteProperty($object, 'a');
      expect($object).toEqual({ b: 2 });
    });

    it('should return false for non-existing property', () => {
      const $object = { a: 1 };
      expect(deleteProperty($object, 'b' as keyof typeof $object)).toBe(false);
    });
  });

  describe('deleteProperties', () => {
    it('should return true when deleting existing properties', () => {
      const $object = { a: 1, b: 2, c: 3 };
      expect(deleteProperties($object, ['a', 'c'])).toBe(true);
    });

    it('should remove the specified properties from the object', () => {
      const $object = { a: 1, b: 2, c: 3 };
      deleteProperties($object, ['a', 'c']);
      expect($object).toEqual({ b: 2 });
    });

    it('should return false if no properties exist', () => {
      const $object = { a: 1 };
      expect(deleteProperties($object, ['b' as keyof typeof $object])).toBe(false);
    });
  });

  describe('removeUndefinedProperties', () => {
    it('should remove undefined properties', () => {
      const $object: RemoveUndefinedTestObject = { a: 1, b: undefined, c: 'hello' };
      removeUndefinedProperties($object);
      expect($object).toEqual({ a: 1, c: 'hello' });
    });

    it('should keep null and empty string', () => {
      const $object = { a: null, b: '', c: 0 };
      removeUndefinedProperties($object);
      expect($object).toEqual({ a: null, b: '', c: 0 });
    });
  });

  describe('extractDefaultExportInterop', () => {
    it('should extract default export from module-like object', () => {
      const module = { default: 'value' };
      expect(extractDefaultExportInterop(module)).toBe('value');
    });

    it('should return value directly if no default property', () => {
      const value = { foo: 'bar' };
      expect(extractDefaultExportInterop(value)).toEqual({ foo: 'bar' });
    });

    it.each([
      /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Assertions needed for extractDefaultExportInterop generic. */
      [42 as unknown, 42],
      [null as unknown, null]
      /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion -- Re-enable after array items. */
    ])('should return primitives directly %j → %j', (input, expected) => {
      expect(extractDefaultExportInterop(input)).toBe(expected);
    });
  });

  describe('getPrototypeOf', () => {
    it('should return prototype of object', () => {
      const prototype = { hello: 'world' };
      const $object = Object.create(prototype);
      expect(getPrototypeOf($object)).toBe(prototype);
    });

    it('should return null for null-prototype objects', () => {
      const $object = Object.create(null);
      expect(getPrototypeOf($object)).toBeNull();
    });

    it('should return null for null', () => {
      expect(getPrototypeOf(null)).toBeNull();
    });

    it('should return undefined for undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Need to test `void` as `undefined`.
      expect(getPrototypeOf(undefined)).toBeUndefined();
    });
  });

  describe('nameof', () => {
    it('should return the property name', () => {
      interface TestObject {
        myProp: string;
        other: number;
      }
      expect(nameof<TestObject>('myProp')).toBe('myProp');
    });
  });

  describe('cloneWithNonEnumerableProperties', () => {
    it('should produce a clone equal to the original', () => {
      const $object = { a: 1, b: 'hello' };
      const clone = cloneWithNonEnumerableProperties($object);
      expect(clone).toEqual($object);
    });

    it('should produce a clone that is not the same reference', () => {
      const $object = { a: 1, b: 'hello' };
      const clone = cloneWithNonEnumerableProperties($object);
      expect(clone).not.toBe($object);
    });

    it('should clone non-enumerable properties', () => {
      const $object: GenericObject = {};
      Object.defineProperty($object, 'hidden', { enumerable: false, value: 42 });
      const clone = cloneWithNonEnumerableProperties($object);
      expect(Object.getOwnPropertyDescriptor(clone, 'hidden')?.value).toBe(42);
    });
  });

  describe('assignWithNonEnumerableProperties', () => {
    it('should produce a result with merged properties', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      const result = assignWithNonEnumerableProperties(target, source);
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should return the same target reference', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      const result = assignWithNonEnumerableProperties(target, source);
      expect(result).toBe(target);
    });

    it('should assign non-enumerable properties', () => {
      const target: GenericObject = { a: 1 };
      const source: GenericObject = {};
      Object.defineProperty(source, 'hidden', { configurable: true, enumerable: false, value: 42, writable: true });
      assignWithNonEnumerableProperties(target, source);
      expect(Object.getOwnPropertyDescriptor(target, 'hidden')?.value).toBe(42);
    });

    it('should skip prototype key when assigning', () => {
      const target: GenericObject = {};
      const source = ensureGenericObject(Object.create(null));
      Object.defineProperties(source, {
        other: { configurable: true, enumerable: true, value: 'kept', writable: true },
        prototype: { configurable: true, enumerable: true, value: 'test', writable: true }
      });
      assignWithNonEnumerableProperties(target, source);
      expect(Object.getOwnPropertyDescriptor(target, 'prototype')).toBeUndefined();
      expect(target['other']).toBe('kept');
    });

    it('should skip read-only non-configurable properties on target', () => {
      const target: GenericObject = {};
      Object.defineProperty(target, 'locked', { configurable: false, enumerable: true, value: 'original', writable: false });
      const source: GenericObject = {};
      Object.defineProperty(source, 'locked', { configurable: true, enumerable: true, value: 'new', writable: true });
      assignWithNonEnumerableProperties(target, source);
      expect(target['locked']).toBe('original');
    });

    it('should silently ignore defineProperty failures', () => {
      const target: GenericObject = {};
      const source = { a: 1 };
      const originalDefineProperty = Object.defineProperty;
      afterEach(() => {
        vi.restoreAllMocks();
      });
      vi.spyOn(Object, 'defineProperty').mockImplementation(($object, property, descriptor) => {
        if (property === 'a' && $object === target) {
          throw new Error('Cannot define property');
        }
        return originalDefineProperty($object, property, descriptor as PropertyDescriptor);
      });
      expect(() => assignWithNonEnumerableProperties(target, source)).not.toThrow();
    });
  });

  describe('toJson', () => {
    it.each([
      [42, '42'],
      ['hello', '"hello"'],
      [true, 'true'],
      [null, 'null']
    ])('should serialize primitive %j to %s', (input, expected) => {
      expect(toJson(input)).toBe(expected);
    });

    it('should serialize objects', () => {
      const json = toJson({ a: 1, b: 'two' });
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ a: 1, b: 'two' });
    });

    it('should serialize arrays', () => {
      const json = toJson([1, 2, 3]);
      expect(JSON.parse(json)).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', () => {
      const json = toJson({ a: { b: { c: 42 } } });
      expect(JSON.parse(json)).toEqual({ a: { b: { c: 42 } } });
    });

    it('should handle circular references when enabled', () => {
      const $object: GenericObject = { a: 1 };
      $object['self'] = $object;
      const json = toJson($object, { shouldHandleCircularReferences: true });
      expect(json).toContain('CircularReference');
    });

    it('should throw on circular references when not enabled', () => {
      const $object: GenericObject = { a: 1 };
      $object['self'] = $object;
      expect(() => toJson($object)).toThrow('Converting circular structure to JSON');
    });

    it('should handle undefined values when enabled', () => {
      const json = toJson(undefined, { shouldHandleUndefined: true });
      expect(json).toContain('undefined');
    });

    it('should handle undefined at root', () => {
      const json = toJson(undefined);
      expect(json).toContain('undefined');
    });

    it('should exclude functions by default', () => {
      const $object = { a: 1, fn: noop };
      const json = toJson($object);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ a: 1 });
    });

    it('should include function names when NameOnly mode', () => {
      function myFunction(): void {
        noop();
      }
      const $object = { a: 1, fn: myFunction };
      const json = toJson($object, { functionHandlingMode: FunctionHandlingMode.NameOnly });
      expect(json).toContain('myFunc');
    });

    it('should include full function when Full mode', () => {
      function myFunction(): number {
        return 42;
      }
      const $object = { fn: myFunction };
      const json = toJson($object, { functionHandlingMode: FunctionHandlingMode.Full });
      expect(json).toContain('return 42');
    });

    it('should respect maxDepth', () => {
      const $object = { a: { b: { c: { d: 1 } } } };
      const json = toJson($object, { maxDepth: 1 });
      expect(json).toContain('MaxDepthLimitReached');
    });

    it('should sort keys when enabled', () => {
      const $object = { a: 2, m: 3, z: 1 };
      const json = toJson($object, { shouldSortKeys: true });
      const keys = Object.keys(JSON.parse(json) as object);
      expect(keys).toEqual(['a', 'm', 'z']);
    });

    it('should handle errors when enabled', () => {
      const error = new Error('test error');
      const json = toJson(error, { shouldHandleErrors: true });
      expect(json).toContain('test error');
    });

    it('should handle toJSON failures when enabled', () => {
      const $object = {
        toJSON(): never {
          throw new Error('toJSON failed');
        }
      };
      const json = toJson($object, { shouldCatchToJSONErrors: true });
      expect(json).toContain('ToJSONFailed');
    });

    it('should use custom space', () => {
      const json = toJson({ a: 1 }, { space: 4 });
      expect(json).toContain('    "a"');
    });

    it('should show MaxDepthLimitReachedArray for arrays exceeding maxDepth', () => {
      const $object = { items: [1, 2, 3] };
      const json = toJson($object, { maxDepth: 0 });
      expect(json).toContain('Array(3)');
    });

    it('should throw on toJSON failure when shouldCatchToJSONErrors is false', () => {
      const $object = {
        toJSON(): never {
          throw new Error('toJSON exploded');
        }
      };
      expect(() => toJson($object)).toThrow('toJSON exploded');
    });

    it('should handle undefined properties within objects when shouldHandleUndefined is true', () => {
      const $object = { a: 1, b: undefined };
      const json = toJson($object, { shouldHandleUndefined: true });
      expect(json).toContain('undefined');
    });

    it('should handle arrow functions in NameOnly mode', () => {
      function namedFunction(): void {
        noop();
      }
      const $object = { fn: namedFunction };
      const json = toJson($object, { functionHandlingMode: FunctionHandlingMode.NameOnly });
      expect(json).toContain('function namedFunction()');
    });

    it('should use custom tokenSubstitutions for circular references', () => {
      const $object: GenericObject = { a: 1 };
      $object['self'] = $object;
      const json = toJson($object, {
        shouldHandleCircularReferences: true,
        tokenSubstitutions: { circularReference: '"[CIRCULAR]"' }
      });
      expect(json).toContain('[CIRCULAR]');
    });

    it('should use anonymous for unnamed functions in NameOnly mode', () => {
      function $function(): void {
        noop();
      }
      Object.defineProperty($function, 'name', { value: '' });
      const $object = { fn: $function };
      const json = toJson($object, { functionHandlingMode: FunctionHandlingMode.NameOnly });
      expect(json).toContain('anonymous');
    });

    it('should drop undefined properties when shouldHandleUndefined is false', () => {
      const json = toJson({ a: 1, b: undefined });
      const parsed = JSON.parse(json) as object;
      expect(parsed).toEqual({ a: 1 });
    });

    it('should not call nested toJSON when outer toJSON already returned the object', () => {
      const innerToJSON = vi.fn().mockReturnValue({ x: 1 });
      const inner = { toJSON: innerToJSON, y: 2 };
      const outer = {
        toJSON(): object {
          return inner;
        }
      };
      const json = toJson(outer);
      expect(innerToJSON).not.toHaveBeenCalled();
      const parsed = JSON.parse(json) as object;
      expect(parsed).toEqual({ y: 2 });
    });

    it('should use Object as constructor name when constructor has no name', () => {
      function AnonymousCtor(): void {
        noop();
      }
      Object.defineProperty(AnonymousCtor, 'name', { value: '' });
      const $object = ensureGenericObject(Object.create(AnonymousCtor.prototype as object));
      $object['a'] = 1;
      $object['self'] = $object;
      expect(() => toJson($object)).toThrow('starting at object with constructor \'Object\'');
    });

    it('should preserve user strings that look like wikilink placeholders', () => {
      const $object = { link: '[[OldTitle]]' };
      const json = toJson($object);
      expect(JSON.parse(json)).toEqual($object);
    });

    it('should preserve wikilink-like strings that collide with substitution token keys', () => {
      const $object = {
        circular: '[[CircularReference]]',
        functionLink: '[[Function]]',
        indexedFunctionLink: '[[Function1]]',
        plain: '[[Note]]',
        undefinedLink: '[[Undefined]]'
      };
      const json = toJson($object);
      expect(JSON.parse(json)).toEqual($object);
    });

    it('should preserve wikilink-like strings inside arrays', () => {
      const array = ['[[OldTitle]]', '[[Note2]]'];
      const json = toJson(array);
      expect(JSON.parse(json)).toEqual(array);
    });
  });

  describe('getAllKeys advanced', () => {
    it('should include properties with both getter and setter', () => {
      const $object = {
        get prop(): number {
          return 1;
        },
        set prop(_v: number) {
          noop();
        }
      };
      expect(getAllKeys($object)).toContain('prop');
    });

    it('should exclude getter-only properties', () => {
      const $object = {
        get readOnly(): number {
          return 1;
        }
      };
      expect(getAllKeys($object)).not.toContain('readOnly');
    });

    it('should exclude non-enumerable, non-writable properties', () => {
      const $object: GenericObject = {};
      Object.defineProperty($object, 'locked', { enumerable: true, value: 1, writable: false });
      expect(getAllKeys($object)).not.toContain('locked');
    });
  });

  describe('assertNonNullable', () => {
    it('should not throw for a non-null, non-undefined value', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Assertion needed to satisfy NullableConstraint generic.
        assertNonNullable('hello' as string | undefined);
      }).not.toThrow();
    });

    it('should throw "Value is null" when value is null and no error provided', () => {
      expect(() => {
        assertNonNullable(null);
      }).toThrow('Value is null');
    });

    it('should throw "Value is undefined" when value is undefined and no error provided', () => {
      expect(() => {
        assertNonNullable(undefined);
      }).toThrow('Value is undefined');
    });

    it('should throw with the provided string message', () => {
      expect(() => {
        assertNonNullable(null, 'Custom error');
      }).toThrow('Custom error');
    });

    it('should throw the provided Error instance', () => {
      const error = new TypeError('Custom type error');
      expect(() => {
        assertNonNullable(null, error);
      }).toThrow(error);
    });
  });

  describe('normalizeOptionalProperties', () => {
    it('should return the same object as-is', () => {
      const $object = { a: 1, b: undefined };
      const result = normalizeOptionalProperties<NormalizeTestObject>($object);
      expect(result).toBe($object);
    });
  });

  describe('castTo', () => {
    it('should cast a value to the specified type', () => {
      const value: unknown = 'hello';
      const result: string = castTo<string>(value);
      expect(result).toBe('hello');
    });

    it('should cast a number to a different type', () => {
      const value: unknown = 42;
      const result: number = castTo<number>(value);
      expect(result).toBe(42);
    });
  });
});
