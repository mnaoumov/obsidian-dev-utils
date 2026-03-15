import {
  describe,
  expect,
  expectTypeOf,
  it
} from 'vitest';

import {
  assert,
  assertGenericObject,
  assertNonNullable,
  ensureGenericObject,
  ensureNonNullable
} from './type-guards.ts';

describe('TypeGuards', () => {
  describe('assert', () => {
    it('should not throw when condition is true', () => {
      expect(() => {
        assert(true, 'should not throw');
      }).not.toThrow();
    });

    it('should throw with string message when condition is false', () => {
      expect(() => {
        assert(false, 'test error');
      }).toThrow('test error');
    });

    it('should throw the provided Error instance when condition is false', () => {
      const error = new TypeError('custom error');
      expect(() => {
        assert(false, error);
      }).toThrow(error);
    });
  });

  describe('assertGenericObject', () => {
    it('should not throw for a plain object', () => {
      const obj = { key: 'value' };
      expect(() => {
        assertGenericObject(obj);
      }).not.toThrow();
    });

    it('should narrow the type to GenericObject', () => {
      const obj: object = { a: 1, b: 'two' };
      assertGenericObject(obj);
      expect(obj['a']).toBe(1);
      expect(obj['b']).toBe('two');
    });
  });

  describe('assertNonNullable', () => {
    it('should not throw for a defined value', () => {
      expect(() => {
        assertNonNullable('hello' as string | undefined);
      }).not.toThrow();
    });

    it('should throw for null', () => {
      expect(() => {
        assertNonNullable(null);
      }).toThrow('Value is null');
    });

    it('should throw for undefined', () => {
      expect(() => {
        assertNonNullable(undefined);
      }).toThrow('Value is undefined');
    });

    it('should throw with custom message', () => {
      expect(() => {
        assertNonNullable(null, 'custom error');
      }).toThrow('custom error');
    });

    it('should throw with custom Error', () => {
      const error = new Error('my error');
      expect(() => {
        assertNonNullable(null, error);
      }).toThrow(error);
    });
  });

  describe('ensureGenericObject', () => {
    it('should return the object as GenericObject', () => {
      const obj: object = { x: 42 };
      const result = ensureGenericObject(obj);
      expect(result).toBe(obj);
      expect(result['x']).toBe(42);
    });

    it('should preserve original type in the intersection', () => {
      const obj = { name: 'test', value: 123 };
      const result = ensureGenericObject(obj);
      expect(result.name).toBe('test');
      expect(result.value).toBe(123);
      expectTypeOf(result.name).toEqualTypeOf<string>();
      expectTypeOf(result.value).toEqualTypeOf<number>();
    });

    it('should allow accessing unknown properties via index signature', () => {
      const obj = { name: 'test' };
      const result = ensureGenericObject(obj);
      result['newProp'] = 'dynamic';
      expect(result['newProp']).toBe('dynamic');
    });
  });

  describe('ensureNonNullable', () => {
    it('should return the value when not null or undefined', () => {
      expect(ensureNonNullable('hello' as string | undefined)).toBe('hello');
    });

    it('should throw for null', () => {
      expect(() => ensureNonNullable(null)).toThrow('Value is null');
    });

    it('should throw for undefined', () => {
      expect(() => ensureNonNullable(undefined)).toThrow('Value is undefined');
    });
  });
});
