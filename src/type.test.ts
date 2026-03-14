import {
  describe,
  expect,
  expectTypeOf,
  it
} from 'vitest';

import type {
  ExactKeys,
  ExactMembers,
  PropertyValues,
  StringKeys
} from './type.ts';

import { typeAsserter } from './type.ts';

describe('StringKeys', () => {
  it('should extract string keys from an object type', () => {
    interface TestType {
      a: number;
      b: string;
    }
    expectTypeOf<StringKeys<TestType>>().toEqualTypeOf<'a' | 'b'>();
  });
});

describe('PropertyValues', () => {
  it('should extract value types from an object type', () => {
    interface TestType {
      a: number;
      b: string;
    }
    expectTypeOf<PropertyValues<TestType>>().toEqualTypeOf<number | string>();
  });
});

describe('ExactMembers', () => {
  it('should accept exact match', () => {
    expectTypeOf<ExactMembers<'a' | 'b', readonly ['a', 'b']>>().toEqualTypeOf<readonly ['a', 'b']>();
  });

  it('should produce error string for missing members', () => {
    type Result = ExactMembers<'a' | 'b' | 'c', readonly ['a', 'b']>;
    expectTypeOf<Result>().toBeString();
  });

  it('should produce error string for invalid members', () => {
    type Result = ExactMembers<'a' | 'b', readonly ['a', 'b', 'c']>;
    expectTypeOf<Result>().toBeString();
  });

  it('should produce error string for duplicate members', () => {
    type Result = ExactMembers<'a' | 'b', readonly ['a', 'b', 'a']>;
    expectTypeOf<Result>().toBeString();
  });
});

describe('ExactKeys', () => {
  it('should accept exact keys', () => {
    interface TestType {
      x: number;
      y: string;
    }
    expectTypeOf<ExactKeys<TestType, readonly ['x', 'y']>>().toEqualTypeOf<readonly ['x', 'y']>();
  });

  it('should produce error string for missing keys', () => {
    interface TestType {
      a: number;
      b: string;
      c: boolean;
    }
    type Result = ExactKeys<TestType, readonly ['a', 'b']>;
    expectTypeOf<Result>().toBeString();
  });
});

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
