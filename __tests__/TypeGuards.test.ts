import {
  describe,
  expect,
  it
} from 'vitest';

import {
  assertGenericObject,
  assertNonNullable,
  ensureGenericObject,
  ensureNonNullable
} from '../src/TypeGuards.ts';

describe('TypeGuards', () => {
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
