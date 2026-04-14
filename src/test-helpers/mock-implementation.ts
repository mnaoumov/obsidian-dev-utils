/**
 * @file
 *
 * Mock and spy utilities for test files. Provides helpers to spy on methods
 * with access to original implementations.
 */

import type { MockInstance } from 'vitest';

import { vi } from 'vitest';

export { strictProxy } from '../strict-proxy.ts';

const savedOriginals = new WeakMap<object, Map<string, unknown>>();

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
