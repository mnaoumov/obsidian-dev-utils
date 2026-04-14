/**
 * @file
 *
 * Strictly-typed mock object factory via `Proxy`. Throws a descriptive error
 * when any unmocked property is accessed, preventing silent `undefined` returns.
 *
 * The proxy implementation mirrors the design of
 * `obsidian-test-mocks/src/internal/strict-proxy.ts`.
 */

import type { PartialDeep } from 'type-fest';

const STRICT_PROXY_MARKER = Symbol('strictProxy');

const PASSTHROUGH_PROPS = new Set<string | symbol>([
  Symbol.iterator,
  Symbol.toPrimitive,
  Symbol.toStringTag,
  'then',
  'toJSON'
]);

/**
 * Creates a strictly-typed mock object from a partial implementation.
 * Uses a `Proxy` that throws a descriptive error when any unmocked
 * property is accessed, preventing silent `undefined` returns.
 *
 * - Idempotent: double-wrapping is a no-op.
 * - Passthrough for well-known props (`then`, `toJSON`, `Symbol.iterator`, etc.).
 * - Recursive proxying of nested plain objects.
 *
 * @param partial - A partial object containing only the mocked members.
 * @returns A proxy typed as `T` that throws on unmocked property access.
 */
export function strictProxy<T>(partial: PartialDeep<T>): T {
  return wrapProxy<T>(partial);
}

/**
 * Checks if a value is an object-like value (not null).
 *
 * @param value - The value to check.
 * @returns Whether the value is object-like.
 */
function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

/**
 * Checks if a value is a plain object (not a class instance, array, null, etc.).
 *
 * @param value - The value to check.
 * @returns Whether the value is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isObjectLike(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Wraps a value in a strict proxy. Idempotent — double-wrapping is a no-op.
 *
 * @param value - The value to wrap.
 * @returns The proxied value typed as `T`.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T provides return type inference at call sites.
function wrapProxy<T>(value: unknown): T {
  if (!isObjectLike(value)) {
    return value as T;
  }

  if (STRICT_PROXY_MARKER in value) {
    return value as T;
  }
  Object.defineProperty(value, STRICT_PROXY_MARKER, { value: true });

  const proxiedChildren = new Map<string | symbol>();

  return new Proxy(value, {
    get(target, prop, receiver): unknown {
      if (prop in target) {
        if (proxiedChildren.has(prop)) {
          return proxiedChildren.get(prop);
        }

        const val: unknown = Reflect.get(target, prop, receiver);
        if (isPlainObject(val)) {
          const result = wrapProxy<unknown>(val);
          proxiedChildren.set(prop, result);
          return result;
        }
        return val;
      }

      if (typeof prop === 'symbol' || PASSTHROUGH_PROPS.has(prop)) {
        return Reflect.get(target, prop, receiver);
      }

      throw new Error(`Unmocked property "${prop}" was accessed on mock object`);
    }
  }) as T;
}
