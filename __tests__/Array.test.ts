import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  filterInPlace,
  unique,
  uniqueInPlace
} from '../src/Array.ts';

describe('Array', () => {
  describe('filterInPlace', () => {
    it('should filter elements based on predicate', () => {
      const arr = [1, 2, 3, 4, 5];
      filterInPlace(arr, (v) => v % 2 === 0);
      expect(arr).toEqual([2, 4]);
    });

    it('should return an empty array for empty input', () => {
      const arr: number[] = [];
      filterInPlace(arr, () => true);
      expect(arr).toEqual([]);
    });

    it('should have length 0 for empty input', () => {
      const arr: number[] = [];
      filterInPlace(arr, () => true);
      expect(arr.length).toBe(0);
    });

    it('should keep all elements when predicate always returns true', () => {
      const arr = [1, 2, 3];
      filterInPlace(arr, () => true);
      expect(arr).toEqual([1, 2, 3]);
    });

    it('should remove all elements when predicate always returns false', () => {
      const arr = [1, 2, 3];
      filterInPlace(arr, () => false);
      expect(arr).toEqual([]);
    });

    it('should have length 0 when predicate always returns false', () => {
      const arr = [1, 2, 3];
      filterInPlace(arr, () => false);
      expect(arr.length).toBe(0);
    });

    it('should skip sparse array holes and keep defined elements', () => {
      const arr = new Array<number>(5);
      arr[1] = 10;
      arr[3] = 30;
      filterInPlace(arr, () => true);
      expect(arr).toEqual([10, 30]);
    });

    it('should adjust length after filtering sparse array holes', () => {
      const arr = new Array<number>(5);
      arr[1] = 10;
      arr[3] = 30;
      filterInPlace(arr, () => true);
      expect(arr.length).toBe(2);
    });

    it('should call predicate the correct number of times', () => {
      const arr = ['a', 'b', 'c'];
      const predicate = vi.fn(() => true);
      filterInPlace(arr, predicate);
      expect(predicate).toHaveBeenCalledTimes(3);
    });

    it.each([[1, 'a'], [2, 'b'], [3, 'c']])('should pass correct arguments to predicate on call %j for value %j', (callIndex, expectedValue) => {
      const arr = ['a', 'b', 'c'];
      const predicate = vi.fn(() => true);
      filterInPlace(arr, predicate);
      expect(predicate).toHaveBeenNthCalledWith(callIndex, expectedValue, (callIndex as number) - 1, expect.any(Array));
    });

    it('should contain correct elements after filtering', () => {
      const arr = [1, 2, 3, 4, 5, 6];
      filterInPlace(arr, (v) => v > 3);
      expect(arr).toEqual([4, 5, 6]);
    });

    it('should adjust the array length correctly after filtering', () => {
      const arr = [1, 2, 3, 4, 5, 6];
      filterInPlace(arr, (v) => v > 3);
      expect(arr.length).toBe(3);
    });
  });

  describe('unique', () => {
    it('should remove duplicate values', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    });

    it('should preserve the order of first occurrences', () => {
      expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
    });

    it('should not mutate the original array', () => {
      const original = [1, 2, 2, 3];
      unique(original);
      expect(original).toEqual([1, 2, 2, 3]);
    });

    it('should return a new array instance', () => {
      const original = [1, 2, 2, 3];
      const result = unique(original);
      expect(result).not.toBe(original);
    });

    it('should return an empty array for empty input', () => {
      expect(unique([])).toEqual([]);
    });

    it('should return single element array unchanged', () => {
      expect(unique([42])).toEqual([42]);
    });

    it('should deduplicate NaN values to a single NaN', () => {
      const result = unique([NaN, NaN, 1]);
      expect(result).toHaveLength(2);
    });

    it('should keep NaN as the first element when NaN appears first', () => {
      const result = unique([NaN, NaN, 1]);
      expect(result[0]).toBeNaN();
    });

    it('should keep non-NaN values after deduplicating NaN', () => {
      const result = unique([NaN, NaN, 1]);
      expect(result[1]).toBe(1);
    });

    it('should handle mixed types via string coercion behavior of Set', () => {
      const result = unique(['a', 'b', 'a', 'c', 'b']);
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('uniqueInPlace', () => {
    it('should remove duplicates in place', () => {
      const arr = [1, 2, 2, 3, 1, 3];
      uniqueInPlace(arr);
      expect(arr).toEqual([1, 2, 3]);
    });

    it('should handle an empty array', () => {
      const arr: unknown[] = [];
      uniqueInPlace(arr);
      expect(arr).toEqual([]);
    });

    it('should produce the correct deduplicated array for object references', () => {
      const objA = { id: 1 };
      const objB = { id: 2 };
      const arr = [objA, objB, objA, objB, objA];
      uniqueInPlace(arr);
      expect(arr).toEqual([objA, objB]);
    });

    it('should preserve the first object reference identity', () => {
      const objA = { id: 1 };
      const objB = { id: 2 };
      const arr = [objA, objB, objA, objB, objA];
      uniqueInPlace(arr);
      expect(arr[0]).toBe(objA);
    });

    it('should preserve the second object reference identity', () => {
      const objA = { id: 1 };
      const objB = { id: 2 };
      const arr = [objA, objB, objA, objB, objA];
      uniqueInPlace(arr);
      expect(arr[1]).toBe(objB);
    });

    it('should update array length after deduplicating objects', () => {
      const objA = { id: 1 };
      const objB = { id: 2 };
      const arr = [objA, objB, objA, objB, objA];
      uniqueInPlace(arr);
      expect(arr.length).toBe(2);
    });

    it('should not treat different objects with same shape as duplicates', () => {
      const arr = [{ id: 1 }, { id: 1 }];
      uniqueInPlace(arr);
      expect(arr).toHaveLength(2);
    });

    it('should update array length after deduplication', () => {
      const arr = [5, 5, 5, 5];
      uniqueInPlace(arr);
      expect(arr.length).toBe(1);
    });

    it('should contain only unique values after deduplication', () => {
      const arr = [5, 5, 5, 5];
      uniqueInPlace(arr);
      expect(arr).toEqual([5]);
    });
  });
});
