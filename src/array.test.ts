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
} from './array.ts';

describe('Array', () => {
  describe('filterInPlace', () => {
    it('should filter elements based on predicate', () => {
      const array = [1, 2, 3, 4, 5];
      filterInPlace(array, (v) => v % 2 === 0);
      expect(array).toEqual([2, 4]);
    });

    it('should return an empty array for empty input', () => {
      const array: number[] = [];
      filterInPlace(array, () => true);
      expect(array).toEqual([]);
    });

    it('should have length 0 for empty input', () => {
      const array: number[] = [];
      filterInPlace(array, () => true);
      expect(array.length).toBe(0);
    });

    it('should keep all elements when predicate always returns true', () => {
      const array = [1, 2, 3];
      filterInPlace(array, () => true);
      expect(array).toEqual([1, 2, 3]);
    });

    it('should remove all elements when predicate always returns false', () => {
      const array = [1, 2, 3];
      filterInPlace(array, () => false);
      expect(array).toEqual([]);
    });

    it('should have length 0 when predicate always returns false', () => {
      const array = [1, 2, 3];
      filterInPlace(array, () => false);
      expect(array.length).toBe(0);
    });

    it('should skip sparse array holes and keep defined elements', () => {
      const array = new Array<number>(5);
      array[1] = 10;
      array[3] = 30;
      filterInPlace(array, () => true);
      expect(array).toEqual([10, 30]);
    });

    it('should adjust length after filtering sparse array holes', () => {
      const array = new Array<number>(5);
      array[1] = 10;
      array[3] = 30;
      filterInPlace(array, () => true);
      expect(array.length).toBe(2);
    });

    it('should call predicate the correct number of times', () => {
      const array = ['a', 'b', 'c'];
      const predicate = vi.fn(() => true);
      filterInPlace(array, predicate);
      expect(predicate).toHaveBeenCalledTimes(3);
    });

    it.each([[1, 'a'], [2, 'b'], [3, 'c']])('should pass correct arguments to predicate on call %j for value %j', (callIndex, expectedValue) => {
      const array = ['a', 'b', 'c'];
      const predicate = vi.fn(() => true);
      filterInPlace(array, predicate);
      expect(predicate).toHaveBeenNthCalledWith(callIndex, expectedValue, callIndex - 1, expect.any(Array));
    });

    it('should contain correct elements after filtering', () => {
      const array = [1, 2, 3, 4, 5, 6];
      filterInPlace(array, (v) => v > 3);
      expect(array).toEqual([4, 5, 6]);
    });

    it('should adjust the array length correctly after filtering', () => {
      const array = [1, 2, 3, 4, 5, 6];
      filterInPlace(array, (v) => v > 3);
      expect(array.length).toBe(3);
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
      const array = [1, 2, 2, 3, 1, 3];
      uniqueInPlace(array);
      expect(array).toEqual([1, 2, 3]);
    });

    it('should handle an empty array', () => {
      const array: unknown[] = [];
      uniqueInPlace(array);
      expect(array).toEqual([]);
    });

    it('should produce the correct deduplicated array for object references', () => {
      const objectA = { id: 1 };
      const objectB = { id: 2 };
      const array = [objectA, objectB, objectA, objectB, objectA];
      uniqueInPlace(array);
      expect(array).toEqual([objectA, objectB]);
    });

    it('should preserve the first object reference identity', () => {
      const objectA = { id: 1 };
      const objectB = { id: 2 };
      const array = [objectA, objectB, objectA, objectB, objectA];
      uniqueInPlace(array);
      expect(array[0]).toBe(objectA);
    });

    it('should preserve the second object reference identity', () => {
      const objectA = { id: 1 };
      const objectB = { id: 2 };
      const array = [objectA, objectB, objectA, objectB, objectA];
      uniqueInPlace(array);
      expect(array[1]).toBe(objectB);
    });

    it('should update array length after deduplicating objects', () => {
      const objectA = { id: 1 };
      const objectB = { id: 2 };
      const array = [objectA, objectB, objectA, objectB, objectA];
      uniqueInPlace(array);
      expect(array.length).toBe(2);
    });

    it('should not treat different objects with same shape as duplicates', () => {
      const array = [{ id: 1 }, { id: 1 }];
      uniqueInPlace(array);
      expect(array).toHaveLength(2);
    });

    it('should update array length after deduplication', () => {
      const array = [5, 5, 5, 5];
      uniqueInPlace(array);
      expect(array.length).toBe(1);
    });

    it('should contain only unique values after deduplication', () => {
      const array = [5, 5, 5, 5];
      uniqueInPlace(array);
      expect(array).toEqual([5]);
    });
  });
});
