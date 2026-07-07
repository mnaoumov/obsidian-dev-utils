/**
 * @file
 *
 * Mock and spy utilities for test files. Provides helpers to spy on methods
 * with access to original implementations.
 */

import type { MockInstance } from 'vitest';

import { vi } from 'vitest';

import type { GenericFunction } from '../function.ts';

/**
 * Parameters for {@link mockImplementation}.
 *
 * @typeParam T - The type of the object whose method is spied on.
 * @typeParam K - The name of the method to spy on.
 * @typeParam F - The type of the method to spy on.
 */
export interface MockImplementationParams<
  T extends object,
  K extends keyof FunctionPropertyMembers<T> & string,
  F extends GenericFunction = NonNullable<T[K]> extends GenericFunction ? NonNullable<T[K]> : GenericFunction
> {
  /**
   * Replacement function receiving the original implementation and call args.
   *
   * @param originalImplementation - The original implementation of the method.
   * @param args - The real call arguments.
   * @returns The return value of the method.
   */
  impl(this: T, originalImplementation: F, ...args: Parameters<F>): ReturnType<F>;

  /**
   * The method name.
   */
  readonly method: K;

  /**
   * The object whose method to spy on.
   */
  readonly obj: T;
}

// `NonNullable<T[P]>` unwraps optional function members before the `extends GenericFunction` test.
// `obsidian-typings` now declares the constructor pseudo-methods (`constructor2__?` etc.) optional.
// Their type is therefore `Fn | undefined`, which a bare `T[P] extends GenericFunction` rejects.
// Unwrapping with `NonNullable` keeps those optional methods in the accepted method-name union.
type FunctionPropertyMembers<T> = {
  [P in keyof T as NonNullable<T[P]> extends GenericFunction ? P : never]: T[P];
};

const savedOriginals = new WeakMap<object, Map<string, unknown>>();

/**
 * Spies on a method and replaces it with an implementation that receives
 * `originalImplementation` as its first argument, followed by the real call arguments.
 *
 * @param params - The parameters for the spy.
 * @returns The spy instance.
 */
export function mockImplementation<
  T extends object,
  K extends keyof FunctionPropertyMembers<T> & string,
  F extends GenericFunction = NonNullable<T[K]> extends GenericFunction ? NonNullable<T[K]> : GenericFunction
>(params: MockImplementationParams<T, K, F>): MockInstance {
  const {
    impl,
    method,
    obj
  } = params;
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

  const spy = vi.spyOn(obj, method) as MockInstance;
  spy.mockImplementation(function mockImpl(this: T, ...args: Parameters<F>): ReturnType<F> {
    return impl.call(this, originalImplementation, ...args);
  });
  return spy;
}
