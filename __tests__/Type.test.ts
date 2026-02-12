import {
  describe,
  expect,
  it
} from 'vitest';

import {
  assertAllTypeKeys,
  assertAllUnionMembers,
  typeToDummyParam
} from '../src/Type.ts';

describe('typeToDummyParam', () => {
  it('should return a value that can be used as a type parameter', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(dummy).toBeDefined();
  });

  it('should throw when apply trap is triggered', () => {
    const dummy = typeToDummyParam<() => void>();
    expect(() => {
      (dummy as () => void)();
    }).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when get trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => (dummy as { a: number }).a).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when set trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => {
      (dummy as Record<string, unknown>)['a'] = 1;
    }).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when has trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => 'a' in (dummy as object)).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when deleteProperty trap is triggered', () => {
    const dummy = typeToDummyParam<{ a?: number }>();
    expect(() => {
      delete (dummy as Record<string, unknown>)['a'];
    }).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when construct trap is triggered', () => {
    const Dummy = typeToDummyParam<new () => object>();
    expect(() => new (Dummy as new () => object)()).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when ownKeys trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => Object.keys(dummy as object)).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when getPrototypeOf trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => Object.getPrototypeOf(dummy as object)).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when getOwnPropertyDescriptor trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => Object.getOwnPropertyDescriptor(dummy as object, 'a')).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when defineProperty trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => Object.defineProperty(dummy as object, 'b', { value: 1 })).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when isExtensible trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => Object.isExtensible(dummy as object)).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when preventExtensions trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => Object.preventExtensions(dummy as object)).toThrow('Dummy parameter should not be accessed directly.');
  });

  it('should throw when setPrototypeOf trap is triggered', () => {
    const dummy = typeToDummyParam<{ a: number }>();
    expect(() => Object.setPrototypeOf(dummy as object, {})).toThrow('Dummy parameter should not be accessed directly.');
  });
});

describe('assertAllTypeKeys', () => {
  it('should return frozen array of keys for a matching type', () => {
    interface TestType {
      a: number;
      b: string;
      c: boolean;
    }
    const keys = assertAllTypeKeys(typeToDummyParam<TestType>(), ['a', 'b', 'c']);
    expect(keys).toEqual(['a', 'b', 'c']);
  });

  it('should return a frozen array', () => {
    interface TestType {
      x: number;
      y: string;
    }
    const keys = assertAllTypeKeys(typeToDummyParam<TestType>(), ['x', 'y']);
    expect(Object.isFrozen(keys)).toBe(true);
  });

  it('should accept keys in any order', () => {
    interface TestType {
      a: number;
      b: string;
      c: boolean;
    }
    const keys = assertAllTypeKeys(typeToDummyParam<TestType>(), ['c', 'a', 'b']);
    expect(keys).toEqual(['c', 'a', 'b']);
  });

  it('should return a copy, not the original array', () => {
    interface TestType {
      a: number;
    }
    const original = ['a'] as const;
    const keys = assertAllTypeKeys(typeToDummyParam<TestType>(), original);
    expect(keys).not.toBe(original);
  });
});

describe('assertAllUnionMembers', () => {
  it('should return frozen array of members for a matching union', () => {
    type TestUnion = 'a' | 'b' | 'c';
    const members = assertAllUnionMembers(typeToDummyParam<TestUnion>(), ['a', 'b', 'c']);
    expect(members).toEqual(['a', 'b', 'c']);
  });

  it('should return a frozen array', () => {
    type TestUnion = 1 | 2;
    const members = assertAllUnionMembers(typeToDummyParam<TestUnion>(), [1, 2]);
    expect(Object.isFrozen(members)).toBe(true);
  });

  it('should accept members in any order', () => {
    type TestUnion = 'x' | 'y' | 'z';
    const members = assertAllUnionMembers(typeToDummyParam<TestUnion>(), ['z', 'x', 'y']);
    expect(members).toEqual(['z', 'x', 'y']);
  });

  it('should handle numeric union members', () => {
    type NumericUnion = 1 | 2 | 3;
    const members = assertAllUnionMembers(typeToDummyParam<NumericUnion>(), [1, 2, 3]);
    expect(members).toEqual([1, 2, 3]);
  });

  it('should handle mixed string and number union members', () => {
    type MixedUnion = 'a' | 1;
    const members = assertAllUnionMembers(typeToDummyParam<MixedUnion>(), [1, 'a']);
    expect(members).toEqual([1, 'a']);
  });
});
