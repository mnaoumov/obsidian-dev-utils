import {
  describe,
  expect,
  it
} from 'vitest';

import { MapTransformer } from '../../src/transformers/map-transformer.ts';

describe('MapTransformer', () => {
  const transformer = new MapTransformer();

  describe('id', () => {
    it('should return "map"', () => {
      expect(transformer.id).toBe('map');
    });
  });

  describe('canTransform', () => {
    it.each([
      { description: 'an empty Map', value: new Map() },
      { description: 'a Map with entries', value: new Map([['a', 1], ['b', 2]]) }
    ])('should return true for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(true);
    });

    it.each([
      { description: 'a plain object', value: {} },
      { description: 'an array', value: [] },
      { description: 'null', value: null },
      { description: 'undefined', value: undefined },
      { description: 'a Set', value: new Set() }
    ])('should return false for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(false);
    });
  });

  describe('transformValue', () => {
    it('should convert a Map to an array of entries', () => {
      const map = new Map<string, number>([['a', 1], ['b', 2]]);
      const result = transformer.transformValue(map);
      expect(result).toEqual([['a', 1], ['b', 2]]);
    });

    it('should convert an empty Map to an empty array', () => {
      const map = new Map();
      const result = transformer.transformValue(map);
      expect(result).toEqual([]);
    });
  });

  describe('restoreValue', () => {
    it('should convert an entries array back to a Map instance', () => {
      const entries: [string, number][] = [['a', 1], ['b', 2]];
      const result = transformer.restoreValue(entries);
      expect(result).toBeInstanceOf(Map);
    });

    it.each([
      { expected: 1, key: 'a' },
      { expected: 2, key: 'b' }
    ])('should restore entry with key "$key" to value $expected', ({ expected, key }) => {
      const entries: [string, number][] = [['a', 1], ['b', 2]];
      const result = transformer.restoreValue(entries);
      expect(result.get(key)).toBe(expected);
    });

    it('should convert an empty entries array to a Map instance', () => {
      const result = transformer.restoreValue([]);
      expect(result).toBeInstanceOf(Map);
    });

    it('should convert an empty entries array to a Map with size 0', () => {
      const result = transformer.restoreValue([]);
      expect(result.size).toBe(0);
    });
  });

  describe('round-trip', () => {
    it('should preserve the size of a string-to-number map', () => {
      const original = new Map<string, number>([['x', 10], ['y', 20], ['z', 30]]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.size).toBe(original.size);
    });

    it.each([
      { expected: 10, key: 'x' },
      { expected: 20, key: 'y' },
      { expected: 30, key: 'z' }
    ])('should preserve entry "$key" -> $expected through round-trip', ({ expected, key }) => {
      const original = new Map<string, number>([['x', 10], ['y', 20], ['z', 30]]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.get(key)).toBe(expected);
    });

    it('should preserve an empty map', () => {
      const original = new Map();
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.size).toBe(0);
    });

    describe('should preserve a map with various value types', () => {
      const original = new Map<string, unknown>([
        ['arr', [1, 2, 3]],
        ['bool', true],
        ['null', null],
        ['num', 42],
        ['str', 'hello']
      ]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);

      it('should preserve the size', () => {
        expect(restored.size).toBe(original.size);
      });

      it.each([
        { expected: 'hello', key: 'str', matcher: 'toBe' as const },
        { expected: 42, key: 'num', matcher: 'toBe' as const },
        { expected: true, key: 'bool', matcher: 'toBe' as const },
        { expected: null, key: 'null', matcher: 'toBe' as const }
      ])('should preserve "$key" value through round-trip', ({ expected, key }) => {
        expect(restored.get(key)).toBe(expected);
      });

      it('should preserve "arr" value through round-trip', () => {
        expect(restored.get('arr')).toEqual([1, 2, 3]);
      });
    });

    it.each([
      { expected: 'one', key: 1 },
      { expected: 'two', key: 2 }
    ])('should preserve numeric key $key through round-trip', ({ expected, key }) => {
      const original = new Map<number, string>([[1, 'one'], [2, 'two']]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.get(key)).toBe(expected);
    });
  });
});
