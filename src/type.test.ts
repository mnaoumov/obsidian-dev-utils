import {
  describe,
  expect,
  it
} from 'vitest';

import { typeAsserter } from './type.ts';

describe('typeAsserter().assertAllKeys', () => {
  it('should return frozen array of keys for a matching type', () => {
    interface TestType {
      a: number;
      b: string;
      c: boolean;
    }
    const keys = typeAsserter<TestType>().assertAllKeys(['a', 'b', 'c']);
    expect(keys).toEqual(['a', 'b', 'c']);
  });

  it('should return a frozen array', () => {
    interface TestType {
      x: number;
      y: string;
    }
    const keys = typeAsserter<TestType>().assertAllKeys(['x', 'y']);
    expect(Object.isFrozen(keys)).toBe(true);
  });

  it('should accept keys in any order', () => {
    interface TestType {
      a: number;
      b: string;
      c: boolean;
    }
    const keys = typeAsserter<TestType>().assertAllKeys(['c', 'a', 'b']);
    expect(keys).toEqual(['c', 'a', 'b']);
  });

  it('should return a copy, not the original array', () => {
    interface TestType {
      a: number;
    }
    const original = ['a'] as const;
    const keys = typeAsserter<TestType>().assertAllKeys(original);
    expect(keys).not.toBe(original);
  });
});

describe('typeAsserter().assertAllMembers', () => {
  it('should return frozen array of members for a matching union', () => {
    type TestUnion = 'a' | 'b' | 'c';
    const members = typeAsserter<TestUnion>().assertAllMembers(['a', 'b', 'c']);
    expect(members).toEqual(['a', 'b', 'c']);
  });

  it('should return a frozen array', () => {
    type TestUnion = 1 | 2;
    const members = typeAsserter<TestUnion>().assertAllMembers([1, 2]);
    expect(Object.isFrozen(members)).toBe(true);
  });

  it('should accept members in any order', () => {
    type TestUnion = 'x' | 'y' | 'z';
    const members = typeAsserter<TestUnion>().assertAllMembers(['z', 'x', 'y']);
    expect(members).toEqual(['z', 'x', 'y']);
  });

  it('should handle numeric union members', () => {
    type NumericUnion = 1 | 2 | 3;
    const members = typeAsserter<NumericUnion>().assertAllMembers([1, 2, 3]);
    expect(members).toEqual([1, 2, 3]);
  });

  it('should handle mixed string and number union members', () => {
    type MixedUnion = 'a' | 1;
    const members = typeAsserter<MixedUnion>().assertAllMembers([1, 'a']);
    expect(members).toEqual([1, 'a']);
  });
});
