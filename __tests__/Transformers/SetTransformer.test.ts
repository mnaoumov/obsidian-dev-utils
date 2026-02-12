import {
  describe,
  expect,
  it
} from 'vitest';

import { SetTransformer } from '../../src/Transformers/SetTransformer.ts';

describe('SetTransformer', () => {
  const transformer = new SetTransformer();

  describe('id', () => {
    it('should return "set"', () => {
      expect(transformer.id).toBe('set');
    });
  });

  describe('canTransform', () => {
    it.each([
      { description: 'an empty Set', value: new Set() },
      { description: 'a Set with values', value: new Set([1, 2, 3]) }
    ])('should return true for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(true);
    });

    it.each([
      { description: 'an array', value: [1, 2, 3] },
      { description: 'a plain object', value: {} },
      { description: 'null', value: null },
      { description: 'undefined', value: undefined },
      { description: 'a Map', value: new Map() }
    ])('should return false for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(false);
    });
  });

  describe('transformValue', () => {
    it('should convert a Set to an array', () => {
      const set = new Set([1, 2, 3]);
      const result = transformer.transformValue(set);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should convert an empty Set to an empty array', () => {
      const set = new Set();
      const result = transformer.transformValue(set);
      expect(result).toEqual([]);
    });
  });

  describe('restoreValue', () => {
    it('should convert an array back to a Set instance', () => {
      const result = transformer.restoreValue([1, 2, 3]);
      expect(result).toBeInstanceOf(Set);
    });

    it.each([1, 2, 3])('should include value %i in the restored Set', (value) => {
      const result = transformer.restoreValue([1, 2, 3]);
      expect(result.has(value)).toBe(true);
    });

    it('should restore a Set with the correct size', () => {
      const result = transformer.restoreValue([1, 2, 3]);
      expect(result.size).toBe(3);
    });

    it('should convert an empty array to a Set instance', () => {
      const result = transformer.restoreValue([]);
      expect(result).toBeInstanceOf(Set);
    });

    it('should convert an empty array to a Set with size 0', () => {
      const result = transformer.restoreValue([]);
      expect(result.size).toBe(0);
    });
  });

  describe('round-trip', () => {
    it('should preserve the size of a numeric set', () => {
      const original = new Set([10, 20, 30]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.size).toBe(original.size);
    });

    it.each([10, 20, 30])('should preserve value %i through round-trip', (value) => {
      const original = new Set([10, 20, 30]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.has(value)).toBe(true);
    });

    it('should preserve an empty set', () => {
      const original = new Set();
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.size).toBe(0);
    });

    describe('should preserve a set with string values', () => {
      const original = new Set(['alpha', 'beta', 'gamma']);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);

      it('should preserve the size', () => {
        expect(restored.size).toBe(3);
      });

      it.each(['alpha', 'beta', 'gamma'])('should contain "%s"', (value) => {
        expect(restored.has(value)).toBe(true);
      });
    });

    describe('should preserve a set with mixed types', () => {
      const original = new Set<unknown>([1, null, true, 'two']);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);

      it('should preserve the size', () => {
        expect(restored.size).toBe(4);
      });

      it.each([
        { description: 'number 1', value: 1 },
        { description: 'string "two"', value: 'two' },
        { description: 'boolean true', value: true },
        { description: 'null', value: null }
      ])('should contain $description', ({ value }) => {
        expect(restored.has(value)).toBe(true);
      });
    });
  });
});
