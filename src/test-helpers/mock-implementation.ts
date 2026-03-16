/**
 * @packageDocumentation
 *
 * Mock and spy utilities for test files. Provides helpers to spy on methods
 * with access to original implementations, create strictly-typed mock objects
 * via `Proxy`, and detect plain objects for recursive proxying.
 */

import type { PartialDeep } from 'type-fest';
import type { MockInstance } from 'vitest';

import { vi } from 'vitest';

const savedOriginals = new WeakMap<object, Map<string, unknown>>();

/**
 * Creates a strictly-typed mock object from a partial implementation.
 * Unlike `castTo<T>()`, this uses a `Proxy` to throw an error if any
 * unmocked property is accessed, preventing silent `undefined` returns
 * that don't match the actual type.
 *
 * Nested plain objects are recursively proxied for deep protection.
 * Functions (including `vi.fn()`), arrays, class instances, and primitives
 * are passed through without proxying.
 *
 * @param partial - A partial object containing only the mocked members.
 * @returns A proxy typed as `T` that throws on unmocked property access.
 */
export function createMockOf<T>(partial: PartialDeep<T>): T {
  if (!isPlainObject(partial)) {
    return partial as T;
  }

  const proxiedChildren = new Map<string | symbol, unknown>();

  return new Proxy(partial, {
    get(target, prop, receiver): unknown {
      if (!(prop in target) && typeof prop !== 'symbol') {
        // 'then' must return undefined so that Promise.resolve() / await
        // Can detect non-thenable objects without throwing.
        if (prop === 'then') {
          return undefined;
        }
        throw new Error(`Unmocked property "${prop}" was accessed on mock object`);
      }

      if (proxiedChildren.has(prop)) {
        return proxiedChildren.get(prop);
      }

      const value = Reflect.get(target, prop, receiver);
      if (isPlainObject(value)) {
        const result = createMockOf(value as PartialDeep<Record<string, unknown>>);
        proxiedChildren.set(prop, result);
        return result;
      }
      return value;
    }
  }) as T;
}

/**
 * Spies on a method and replaces it with an implementation that receives
 * `originalImplementation` as its first argument, followed by the real call arguments.
 *
 * @param obj - The object whose method to spy on.
 * @param method - The method name.
 * @param impl - Replacement function receiving the original implementation and call args.
 * @returns The spy instance.
 */

export function mockImplementation<
  T extends object,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Matches vitest's Procedure type: (...args: any[]) => any.
  K extends keyof { [P in keyof T as T[P] extends (...args: any[]) => any ? P : never]: T[P] } & string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Matches vitest's Procedure type for conditional inference.
  F extends (...args: any[]) => any = T[K] extends (...args: any[]) => any ? T[K] : (...args: unknown[]) => unknown
>(
  obj: T,
  method: K,
  impl: (this: T, originalImplementation: F, ...args: Parameters<F>) => ReturnType<F>
): MockInstance {
  let map = savedOriginals.get(obj);
  if (!map) {
    map = new Map();
    savedOriginals.set(obj, map);
  }

  const current = obj[method];
  if (!map.has(method) && !vi.isMockFunction(current)) {
    map.set(method, current);
  }

  const originalImplementation = map.get(method) as F;

  const spy = vi.spyOn(obj, method);
  spy.mockImplementation(function mockImpl(this: unknown, ...args: unknown[]): unknown {
    return impl.call(this as T, originalImplementation, ...(args as Parameters<F>));
  } as never);
  return spy as MockInstance;
}

/**
 * Checks if a value is a plain object (not a class instance, array, null, etc.).
 *
 * @param value - The value to check.
 * @returns Whether the value is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
