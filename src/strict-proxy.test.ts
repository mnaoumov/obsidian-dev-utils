import {
  describe,
  expect,
  it
} from 'vitest';

import {
  bypassStrictProxy,
  strictProxy
} from './strict-proxy.ts';
import { ensureGenericObject } from './type-guards.ts';

interface Nested {
  value: number;
}

interface TestObj {
  fn(): string;
  name: string;
  nested: Nested;
}

describe('strictProxy', () => {
  it('should return provided properties', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(proxy.name).toBe('test');
  });

  it('should throw on unmocked property access', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(() => proxy.fn()).toThrow('Unmocked property "fn" was accessed on mock object');
  });

  it('should recursively proxy nested plain objects', () => {
    const proxy = strictProxy<TestObj>({ nested: { value: 42 } });
    expect(proxy.nested.value).toBe(42);
  });

  it('should cache proxied children and return the same reference', () => {
    const proxy = strictProxy<TestObj>({ nested: { value: 42 } });
    const first = proxy.nested;
    const second = proxy.nested;
    expect(first).toBe(second);
  });

  it('should be idempotent — double-wrapping is a no-op', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    const doubleWrapped = strictProxy<TestObj>(proxy);
    expect(doubleWrapped).toBe(proxy);
    expect(doubleWrapped.name).toBe('test');
  });

  it('should pass through "then" without throwing', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(ensureGenericObject(proxy)['then']).toBeUndefined();
  });

  it('should pass through "toJSON" without throwing', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(ensureGenericObject(proxy)['toJSON']).toBeUndefined();
  });

  it('should pass through Symbol.iterator without throwing', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(ensureGenericObject(proxy)[Symbol.iterator]).toBeUndefined();
  });

  it('should pass through Symbol.toPrimitive without throwing', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(ensureGenericObject(proxy)[Symbol.toPrimitive]).toBeUndefined();
  });

  it('should pass through Symbol.toStringTag without throwing', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(ensureGenericObject(proxy)[Symbol.toStringTag]).toBeUndefined();
  });

  it('should pass through arbitrary symbols without throwing', () => {
    const sym = Symbol('custom');
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(ensureGenericObject(proxy)[sym]).toBeUndefined();
  });

  it('should return non-object values as-is', () => {
    const result = strictProxy<string>('hello');
    expect(result).toBe('hello');
  });

  it('should return null as-is', () => {
    const result = strictProxy<null>(null);
    expect(result).toBeNull();
  });

  it('should not recursively proxy class instances', () => {
    class MyClass {
      public value = 10;
    }
    interface ObjWithClass {
      instance: MyClass;
    }
    const instance = new MyClass();
    const proxy = strictProxy<ObjWithClass>({ instance });
    expect(proxy.instance).toBe(instance);
  });

  it('should not recursively proxy arrays', () => {
    interface ObjWithArr {
      items: number[];
    }
    const items = [1, 2, 3];
    const proxy = strictProxy<ObjWithArr>({ items });
    expect(proxy.items).toBe(items);
  });

  it('should call provided functions correctly', () => {
    const proxy = strictProxy<TestObj>({ fn: () => 'result' });
    expect(proxy.fn()).toBe('result');
  });
});

describe('bypassStrictProxy', () => {
  it('should return non-object values as-is', () => {
    expect(bypassStrictProxy('hello')).toBe('hello');
    expect(bypassStrictProxy(42)).toBe(42);
    expect(bypassStrictProxy(null)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Testing void return for undefined input.
    const undefinedResult: undefined = bypassStrictProxy(undefined);
    expect(undefinedResult).toBeUndefined();
  });

  it('should return non-proxied objects as-is', () => {
    const obj = { name: 'test' };
    expect(bypassStrictProxy(obj)).toBe(obj);
  });

  it('should unwrap a strict proxy to the underlying object', () => {
    const original = { name: 'test' };
    const proxy = strictProxy<TestObj>(original);
    const unwrapped = bypassStrictProxy(proxy);
    expect(unwrapped).toBe(original);
    expect(unwrapped).not.toBe(proxy);
  });

  it('should allow accessing missing properties on unwrapped object', () => {
    const proxy = strictProxy<TestObj>({ name: 'test' });
    expect(() => proxy.fn).toThrow();

    const unwrapped = bypassStrictProxy(proxy);
    expect((unwrapped as Partial<TestObj>).fn).toBeUndefined();
  });
});
