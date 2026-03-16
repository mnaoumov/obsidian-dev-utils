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

interface NormalizeTestObj {
  a: number;
  b?: number;
}

interface RemoveUndefinedTestObj {
  a: number;
  b?: undefined;
  c: string;
}

describe('ObjectUtils', () => {
  describe('deepEqual', () => {
    it('should return true for identical references', () => {
      const obj = { a: 1 };
      expect(deepEqual(obj, obj)).toBe(true);
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
      const obj = { a: 1, b: 'hello' };
      expect(getAllKeys(obj)).toEqual(['a', 'b']);
    });

    it('should return sorted keys', () => {
      const obj = { a: 2, m: 3, z: 1 };
      expect(getAllKeys(obj)).toEqual(['a', 'm', 'z']);
    });

    it('should skip function values', () => {
      const obj = { a: 1, fn: noop };
      expect(getAllKeys(obj)).toEqual(['a']);
    });

    it('should skip __proto__', () => {
      const obj = ensureGenericObject(Object.create(null));
      // eslint-disable-next-line no-proto -- Testing `__proto__`.
      obj['__proto__'] = 'test';
      obj['a'] = 1;
      expect(getAllKeys(obj)).toContain('a');
    });
  });

  describe('getAllEntries', () => {
    it('should return key-value pairs', () => {
      const obj = { a: 1, b: 'two' };
      const entries = getAllEntries(obj);
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
      const obj: GenericObject = { a: 1 };
      setNestedPropertyValue(obj, 'a', 2);
      expect(obj['a']).toBe(2);
    });

    it('should set a nested property', () => {
      const obj = { a: { b: { c: 1 } } };
      setNestedPropertyValue(ensureGenericObject(obj), 'a.b.c', 42);
      expect(obj.a.b.c).toBe(42);
    });

    it('should throw for missing intermediate path', () => {
      const obj: GenericObject = { a: 1 };
      expect(() => {
        setNestedPropertyValue(obj, 'x.y.z', 42);
      }).toThrow('Property path x.y.z not found');
    });

    it('should throw when last intermediate resolves to undefined', () => {
      const obj: GenericObject = { a: undefined };
      expect(() => {
        setNestedPropertyValue(obj, 'a.b', 42);
      }).toThrow('Property path a.b not found');
    });
  });

  describe('deleteProperty', () => {
    it('should return true when deleting an existing property', () => {
      const obj = { a: 1, b: 2 };
      expect(deleteProperty(obj, 'a')).toBe(true);
    });

    it('should remove the property from the object', () => {
      const obj = { a: 1, b: 2 };
      deleteProperty(obj, 'a');
      expect(obj).toEqual({ b: 2 });
    });

    it('should return false for non-existing property', () => {
      const obj = { a: 1 };
      expect(deleteProperty(obj, 'b' as keyof typeof obj)).toBe(false);
    });
  });

  describe('deleteProperties', () => {
    it('should return true when deleting existing properties', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(deleteProperties(obj, ['a', 'c'])).toBe(true);
    });

    it('should remove the specified properties from the object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      deleteProperties(obj, ['a', 'c']);
      expect(obj).toEqual({ b: 2 });
    });

    it('should return false if no properties exist', () => {
      const obj = { a: 1 };
      expect(deleteProperties(obj, ['b' as keyof typeof obj])).toBe(false);
    });
  });

  describe('removeUndefinedProperties', () => {
    it('should remove undefined properties', () => {
      const obj: RemoveUndefinedTestObj = { a: 1, b: undefined, c: 'hello' };
      removeUndefinedProperties(obj);
      expect(obj).toEqual({ a: 1, c: 'hello' });
    });

    it('should keep null and empty string', () => {
      const obj = { a: null, b: '', c: 0 };
      removeUndefinedProperties(obj);
      expect(obj).toEqual({ a: null, b: '', c: 0 });
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
      [42 as unknown, 42],
      [null as unknown, null]
    ])('should return primitives directly %j → %j', (input, expected) => {
      expect(extractDefaultExportInterop(input)).toBe(expected);
    });
  });

  describe('getPrototypeOf', () => {
    it('should return prototype of object', () => {
      const proto = { hello: 'world' };
      const obj = Object.create(proto);
      expect(getPrototypeOf(obj)).toBe(proto);
    });

    it('should return null for null-prototype objects', () => {
      const obj = Object.create(null);
      expect(getPrototypeOf(obj)).toBeNull();
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
      interface TestObj {
        myProp: string;
        other: number;
      }
      expect(nameof<TestObj>('myProp')).toBe('myProp');
    });
  });

  describe('cloneWithNonEnumerableProperties', () => {
    it('should produce a clone equal to the original', () => {
      const obj = { a: 1, b: 'hello' };
      const clone = cloneWithNonEnumerableProperties(obj);
      expect(clone).toEqual(obj);
    });

    it('should produce a clone that is not the same reference', () => {
      const obj = { a: 1, b: 'hello' };
      const clone = cloneWithNonEnumerableProperties(obj);
      expect(clone).not.toBe(obj);
    });

    it('should clone non-enumerable properties', () => {
      const obj: GenericObject = {};
      Object.defineProperty(obj, 'hidden', { enumerable: false, value: 42 });
      const clone = cloneWithNonEnumerableProperties(obj);
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
      Object.defineProperty(source, 'prototype', { configurable: true, enumerable: true, value: 'test', writable: true });
      Object.defineProperty(source, 'other', { configurable: true, enumerable: true, value: 'kept', writable: true });
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
      vi.spyOn(Object, 'defineProperty').mockImplementation((obj, prop, descriptor) => {
        if (prop === 'a' && obj === target) {
          throw new Error('Cannot define property');
        }
        return originalDefineProperty(obj, prop, descriptor as PropertyDescriptor);
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
      const obj: GenericObject = { a: 1 };
      obj['self'] = obj;
      const json = toJson(obj, { shouldHandleCircularReferences: true });
      expect(json).toContain('CircularReference');
    });

    it('should throw on circular references when not enabled', () => {
      const obj: GenericObject = { a: 1 };
      obj['self'] = obj;
      expect(() => toJson(obj)).toThrow('Converting circular structure to JSON');
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
      const obj = { a: 1, fn: noop };
      const json = toJson(obj);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ a: 1 });
    });

    it('should include function names when NameOnly mode', () => {
      function myFunc(): void {
        noop();
      }
      const obj = { a: 1, fn: myFunc };
      const json = toJson(obj, { functionHandlingMode: FunctionHandlingMode.NameOnly });
      expect(json).toContain('myFunc');
    });

    it('should include full function when Full mode', () => {
      function myFunc(): number {
        return 42;
      }
      const obj = { fn: myFunc };
      const json = toJson(obj, { functionHandlingMode: FunctionHandlingMode.Full });
      expect(json).toContain('return 42');
    });

    it('should respect maxDepth', () => {
      const obj = { a: { b: { c: { d: 1 } } } };
      const json = toJson(obj, { maxDepth: 1 });
      expect(json).toContain('MaxDepthLimitReached');
    });

    it('should sort keys when enabled', () => {
      const obj = { a: 2, m: 3, z: 1 };
      const json = toJson(obj, { shouldSortKeys: true });
      const keys = Object.keys(JSON.parse(json) as object);
      expect(keys).toEqual(['a', 'm', 'z']);
    });

    it('should handle errors when enabled', () => {
      const error = new Error('test error');
      const json = toJson(error, { shouldHandleErrors: true });
      expect(json).toContain('test error');
    });

    it('should handle toJSON failures when enabled', () => {
      const obj = {
        toJSON(): never {
          throw new Error('toJSON failed');
        }
      };
      const json = toJson(obj, { shouldCatchToJSONErrors: true });
      expect(json).toContain('ToJSONFailed');
    });

    it('should use custom space', () => {
      const json = toJson({ a: 1 }, { space: 4 });
      expect(json).toContain('    "a"');
    });

    it('should show MaxDepthLimitReachedArray for arrays exceeding maxDepth', () => {
      const obj = { items: [1, 2, 3] };
      const json = toJson(obj, { maxDepth: 0 });
      expect(json).toContain('Array(3)');
    });

    it('should throw on toJSON failure when shouldCatchToJSONErrors is false', () => {
      const obj = {
        toJSON(): never {
          throw new Error('toJSON exploded');
        }
      };
      expect(() => toJson(obj)).toThrow('toJSON exploded');
    });

    it('should handle undefined properties within objects when shouldHandleUndefined is true', () => {
      const obj = { a: 1, b: undefined };
      const json = toJson(obj, { shouldHandleUndefined: true });
      expect(json).toContain('undefined');
    });

    it('should handle arrow functions in NameOnly mode', () => {
      function fn(): void {
        noop();
      }
      const obj = { fn };
      const json = toJson(obj, { functionHandlingMode: FunctionHandlingMode.NameOnly });
      expect(json).toContain('function fn()');
    });

    it('should use custom tokenSubstitutions for circular references', () => {
      const obj: GenericObject = { a: 1 };
      obj['self'] = obj;
      const json = toJson(obj, {
        shouldHandleCircularReferences: true,
        tokenSubstitutions: { circularReference: '"[CIRCULAR]"' }
      });
      expect(json).toContain('[CIRCULAR]');
    });

    it('should use anonymous for unnamed functions in NameOnly mode', () => {
      function fn(): void {
        noop();
      }
      Object.defineProperty(fn, 'name', { value: '' });
      const obj = { fn };
      const json = toJson(obj, { functionHandlingMode: FunctionHandlingMode.NameOnly });
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
      const obj = ensureGenericObject(Object.create(AnonymousCtor.prototype));
      obj.a = 1;
      obj.self = obj;
      expect(() => toJson(obj)).toThrow('starting at object with constructor \'Object\'');
    });
  });

  describe('getAllKeys advanced', () => {
    it('should include properties with both getter and setter', () => {
      const obj = {
        get prop(): number {
          return 1;
        },
        set prop(_v: number) {
          noop();
        }
      };
      expect(getAllKeys(obj)).toContain('prop');
    });

    it('should exclude getter-only properties', () => {
      const obj = {
        get readOnly(): number {
          return 1;
        }
      };
      expect(getAllKeys(obj)).not.toContain('readOnly');
    });

    it('should exclude non-enumerable, non-writable properties', () => {
      const obj: GenericObject = {};
      Object.defineProperty(obj, 'locked', { enumerable: true, value: 1, writable: false });
      expect(getAllKeys(obj)).not.toContain('locked');
    });
  });

  describe('assertNonNullable', () => {
    it('should not throw for a non-null, non-undefined value', () => {
      expect(() => {
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
      const obj = { a: 1, b: undefined };
      const result = normalizeOptionalProperties<NormalizeTestObj>(obj);
      expect(result).toBe(obj);
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
