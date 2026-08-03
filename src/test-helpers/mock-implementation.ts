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
   * The object whose method to spy on.
   */
  readonly $object: T;

  /**
   * Replacement function receiving the original implementation and call args.
   *
   * @param originalImplementation - The original implementation of the method.
   * @param $arguments - The real call arguments.
   * @returns The return value of the method.
   */
  impl(this: T, originalImplementation: F, ...$arguments: Parameters<F>): ReturnType<F>;

  /**
   * The method name.
   */
  readonly method: K;
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
    $object,
    impl,
    method
  } = params;
  let map = savedOriginals.get($object);
  if (!map) {
    map = new Map();
    savedOriginals.set($object, map);
  }

  const current = $object[method];
  if (!map.has(method) && !vi.isMockFunction(current)) {
    map.set(method, current);
  }

  const originalImplementation = map.get(method) as F;

  const spy = vi.spyOn($object, method) as MockInstance;
  spy.mockImplementation(function mockImpl(this: T, ...$arguments: Parameters<F>): ReturnType<F> {
    return impl.call(this, originalImplementation, ...$arguments);
  });
  return spy;
}
