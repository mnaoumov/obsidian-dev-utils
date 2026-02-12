import {
  describe,
  expect,
  it
} from 'vitest';

import { TwoWayMap } from '../src/TwoWayMap.ts';

describe('TwoWayMap', () => {
  describe('constructor', () => {
    it('should report no keys exist in an empty map', () => {
      const map = new TwoWayMap<string, number>();
      expect(map.hasKey('anything')).toBe(false);
    });

    it('should have no entries in an empty map', () => {
      const map = new TwoWayMap<string, number>();
      expect([...map.entries()]).toEqual([]);
    });

    it.each([['a', 1], ['b', 2], ['c', 3]])('should initialize getValue(%j) to %j from entries', (key, value) => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]);
      expect(map.getValue(key as string)).toBe(value);
    });

    it.each([[1, 'a'], [2, 'b'], [3, 'c']])('should initialize getKey(%j) to %j from entries', (value, key) => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]);
      expect(map.getKey(value as number)).toBe(key);
    });
  });

  describe('set and get', () => {
    it('should retrieve value by key after set', () => {
      const map = new TwoWayMap<string, number>();
      map.set('foo', 42);
      expect(map.getValue('foo')).toBe(42);
    });

    it('should retrieve key by value after set', () => {
      const map = new TwoWayMap<string, number>();
      map.set('foo', 42);
      expect(map.getKey(42)).toBe('foo');
    });

    it('should return undefined for a missing key', () => {
      const map = new TwoWayMap<string, number>();
      expect(map.getValue('missing')).toBeUndefined();
    });

    it('should return undefined for a missing value', () => {
      const map = new TwoWayMap<string, number>();
      expect(map.getKey(999)).toBeUndefined();
    });

    it('should return the new value when overwriting the same key', () => {
      const map = new TwoWayMap<string, number>();
      map.set('key', 1);
      map.set('key', 2);
      expect(map.getValue('key')).toBe(2);
    });

    it('should map the new value back to the key when overwriting', () => {
      const map = new TwoWayMap<string, number>();
      map.set('key', 1);
      map.set('key', 2);
      expect(map.getKey(2)).toBe('key');
    });

    it('should remove the old reverse mapping when overwriting the same key', () => {
      const map = new TwoWayMap<string, number>();
      map.set('key', 1);
      map.set('key', 2);
      expect(map.getKey(1)).toBeUndefined();
    });

    it('should map the value to the new key when overwriting the same value', () => {
      const map = new TwoWayMap<string, number>();
      map.set('a', 100);
      map.set('b', 100);
      expect(map.getKey(100)).toBe('b');
    });

    it('should retrieve the value from the new key when overwriting the same value', () => {
      const map = new TwoWayMap<string, number>();
      map.set('a', 100);
      map.set('b', 100);
      expect(map.getValue('b')).toBe(100);
    });

    it('should remove the old key mapping when overwriting the same value', () => {
      const map = new TwoWayMap<string, number>();
      map.set('a', 100);
      map.set('b', 100);
      expect(map.getValue('a')).toBeUndefined();
    });

    it('should update getValue for the reassigned key', () => {
      const map = new TwoWayMap<string, number>();
      map.set('x', 1);
      map.set('y', 2);
      map.set('x', 2);
      expect(map.getValue('x')).toBe(2);
    });

    it('should update getKey for the reassigned value', () => {
      const map = new TwoWayMap<string, number>();
      map.set('x', 1);
      map.set('y', 2);
      map.set('x', 2);
      expect(map.getKey(2)).toBe('x');
    });

    it('should remove the displaced key after reassignment', () => {
      const map = new TwoWayMap<string, number>();
      map.set('x', 1);
      map.set('y', 2);
      map.set('x', 2);
      expect(map.getValue('y')).toBeUndefined();
    });

    it('should remove the displaced value after reassignment', () => {
      const map = new TwoWayMap<string, number>();
      map.set('x', 1);
      map.set('y', 2);
      map.set('x', 2);
      expect(map.getKey(1)).toBeUndefined();
    });
  });

  describe('hasKey and hasValue', () => {
    it('should return true for existing key', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      expect(map.hasKey('a')).toBe(true);
    });

    it('should return false for non-existing key', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      expect(map.hasKey('b')).toBe(false);
    });

    it('should return true for existing value', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      expect(map.hasValue(1)).toBe(true);
    });

    it('should return false for non-existing value', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      expect(map.hasValue(99)).toBe(false);
    });
  });

  describe('deleteKey', () => {
    it('should remove the key after deleting by key', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteKey('a');
      expect(map.hasKey('a')).toBe(false);
    });

    it('should remove the associated value after deleting by key', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteKey('a');
      expect(map.hasValue(1)).toBe(false);
    });

    it('should return undefined for getValue of deleted key', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteKey('a');
      expect(map.getValue('a')).toBeUndefined();
    });

    it('should return undefined for getKey of deleted value', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteKey('a');
      expect(map.getKey(1)).toBeUndefined();
    });

    it('should not affect other keys when deleting a key', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteKey('a');
      expect(map.hasKey('b')).toBe(true);
    });

    it('should not affect other values when deleting a key', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteKey('a');
      expect(map.hasValue(2)).toBe(true);
    });

    it('should be a no-op for hasKey when deleting a non-existent key', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      map.deleteKey('nonexistent');
      expect(map.hasKey('a')).toBe(true);
    });

    it('should be a no-op for hasValue when deleting a non-existent key', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      map.deleteKey('nonexistent');
      expect(map.hasValue(1)).toBe(true);
    });
  });

  describe('deleteValue', () => {
    it('should remove the value after deleting by value', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteValue(1);
      expect(map.hasValue(1)).toBe(false);
    });

    it('should remove the associated key after deleting by value', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteValue(1);
      expect(map.hasKey('a')).toBe(false);
    });

    it('should return undefined for getValue of the associated key after deleting by value', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteValue(1);
      expect(map.getValue('a')).toBeUndefined();
    });

    it('should return undefined for getKey of deleted value', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteValue(1);
      expect(map.getKey(1)).toBeUndefined();
    });

    it('should not affect other keys when deleting by value', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteValue(1);
      expect(map.hasKey('b')).toBe(true);
    });

    it('should not affect other values when deleting by value', () => {
      const map = new TwoWayMap<string, number>([['a', 1], ['b', 2]]);
      map.deleteValue(1);
      expect(map.hasValue(2)).toBe(true);
    });

    it('should be a no-op for hasKey when deleting a non-existent value', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      map.deleteValue(999);
      expect(map.hasKey('a')).toBe(true);
    });

    it('should be a no-op for hasValue when deleting a non-existent value', () => {
      const map = new TwoWayMap<string, number>([['a', 1]]);
      map.deleteValue(999);
      expect(map.hasValue(1)).toBe(true);
    });
  });

  describe('clear', () => {
    it.each(['a', 'b', 'c'])('should remove key %s after clear', (key) => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]);
      map.clear();
      expect(map.hasKey(key)).toBe(false);
    });

    it.each([1, 2, 3])('should remove value %s after clear', (value) => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]);
      map.clear();
      expect(map.hasValue(value)).toBe(false);
    });

    it('should have no entries after clear', () => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]);
      map.clear();
      expect([...map.entries()]).toEqual([]);
    });

    it('should be safe to call on an already empty map', () => {
      const map = new TwoWayMap<string, number>();
      map.clear();
      expect([...map.entries()]).toEqual([]);
    });
  });

  describe('iterators', () => {
    it('should iterate over all entries', () => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2]
      ]);
      const entries = [...map.entries()];
      expect(entries).toEqual([
        ['a', 1],
        ['b', 2]
      ]);
    });

    it('should iterate over all keys', () => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2]
      ]);
      const keys = [...map.keys()];
      expect(keys).toEqual(['a', 'b']);
    });

    it('should iterate over all values', () => {
      const map = new TwoWayMap<string, number>([
        ['a', 1],
        ['b', 2]
      ]);
      const values = [...map.values()];
      expect(values).toEqual([1, 2]);
    });

    it('should return empty entries iterator for an empty map', () => {
      const map = new TwoWayMap<string, number>();
      expect([...map.entries()]).toEqual([]);
    });

    it('should return empty keys iterator for an empty map', () => {
      const map = new TwoWayMap<string, number>();
      expect([...map.keys()]).toEqual([]);
    });

    it('should return empty values iterator for an empty map', () => {
      const map = new TwoWayMap<string, number>();
      expect([...map.values()]).toEqual([]);
    });
  });
});
