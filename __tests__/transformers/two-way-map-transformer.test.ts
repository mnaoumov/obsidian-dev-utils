import {
  describe,
  expect,
  it
} from 'vitest';

import { TwoWayMapTransformer } from '../../src/transformers/two-way-map-transformer.ts';
import { TwoWayMap } from '../../src/two-way-map.ts';

describe('TwoWayMapTransformer', () => {
  const transformer = new TwoWayMapTransformer();

  describe('id', () => {
    it('should return "two-way-map"', () => {
      expect(transformer.id).toBe('two-way-map');
    });
  });

  describe('canTransform', () => {
    it.each([
      { description: 'an empty TwoWayMap', value: new TwoWayMap() },
      { description: 'a TwoWayMap with entries', value: new TwoWayMap([['a', 1], ['b', 2]] as const) }
    ])('should return true for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(true);
    });

    it.each([
      { description: 'a regular Map', value: new Map() },
      { description: 'a plain object', value: {} },
      { description: 'null', value: null },
      { description: 'undefined', value: undefined }
    ])('should return false for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(false);
    });
  });

  describe('transformValue', () => {
    it('should convert a TwoWayMap to an array of entries', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      const result = transformer.transformValue(map);
      expect(result).toEqual([['a', 1], ['b', 2]]);
    });

    it('should convert an empty TwoWayMap to an empty array', () => {
      const map = new TwoWayMap();
      const result = transformer.transformValue(map);
      expect(result).toEqual([]);
    });
  });

  describe('restoreValue', () => {
    it('should convert an entries array back to a TwoWayMap instance', () => {
      const entries: [string, number][] = [['a', 1], ['b', 2]];
      const result = transformer.restoreValue(entries);
      expect(result).toBeInstanceOf(TwoWayMap);
    });

    it.each([
      { expected: 1, key: 'a' },
      { expected: 2, key: 'b' }
    ])('should restore forward lookup "$key" -> $expected', ({ expected, key }) => {
      const entries: [string, number][] = [['a', 1], ['b', 2]];
      const result = transformer.restoreValue(entries);
      expect(result.getValue(key)).toBe(expected);
    });

    it.each([
      { expected: 'a', value: 1 },
      { expected: 'b', value: 2 }
    ])('should restore reverse lookup $value -> "$expected"', ({ expected, value }) => {
      const entries: [string, number][] = [['a', 1], ['b', 2]];
      const result = transformer.restoreValue(entries);
      expect(result.getKey(value)).toBe(expected);
    });

    it('should convert an empty entries array to a TwoWayMap instance', () => {
      const result = transformer.restoreValue([]);
      expect(result).toBeInstanceOf(TwoWayMap);
    });

    it('should convert an empty entries array to a TwoWayMap without any keys', () => {
      const result = transformer.restoreValue([]);
      expect(result.hasKey('anything' as never)).toBe(false);
    });
  });

  describe('round-trip', () => {
    it('should restore to a TwoWayMap instance through round-trip', () => {
      const original = new TwoWayMap<string, number>([['x', 10], ['y', 20], ['z', 30]]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored).toBeInstanceOf(TwoWayMap);
    });

    it.each([
      { expected: 10, key: 'x' },
      { expected: 20, key: 'y' },
      { expected: 30, key: 'z' }
    ])('should preserve forward lookup "$key" -> $expected through round-trip', ({ expected, key }) => {
      const original = new TwoWayMap<string, number>([['x', 10], ['y', 20], ['z', 30]]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.getValue(key)).toBe(expected);
    });

    it.each([
      { expected: 'x', value: 10 },
      { expected: 'y', value: 20 },
      { expected: 'z', value: 30 }
    ])('should preserve reverse lookup $value -> "$expected" through round-trip', ({ expected, value }) => {
      const original = new TwoWayMap<string, number>([['x', 10], ['y', 20], ['z', 30]]);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.getKey(value)).toBe(expected);
    });

    it('should preserve an empty TwoWayMap through round-trip', () => {
      const original = new TwoWayMap();
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored).toBeInstanceOf(TwoWayMap);
    });
  });
});
