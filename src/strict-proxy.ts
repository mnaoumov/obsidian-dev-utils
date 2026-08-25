/**
 * @file
 *
 * Strictly-typed mock object factory via `Proxy`. Throws a descriptive error
 * when any unmocked property is accessed, preventing silent `undefined` returns.
 *
 * The proxy implementation mirrors the design of
 * `obsidian-test-mocks/src/internal/strict-proxy.ts`.
 */

import type { GenericFunction } from './function.ts';

/**
 * A recursive partial type compatible with `exactOptionalPropertyTypes`.
 *
 * Unlike `PartialDeep` from type-fest, this type allows full `T` values at any
 * nesting level via the `| T[K]` union. This is essential for composing nested
 * `strictProxy` calls — an inner `strictProxy<MetadataCache>({...})` returns
 * `MetadataCache`, which must be assignable to the outer partial type.
 *
 * @typeParam T - The target type to create a partial version of.
 */
export type StrictProxyPartial<T> = T extends GenericFunction ? T
  : T extends readonly unknown[] ? T
  : T extends object ? StrictProxyPartialObject<T>
  : T;

type StrictProxyPartialObject<T> = {
  [K in keyof T]?: StrictProxyPartial<T[K]> | T[K];
};

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

/**
 * The markers `@vitest/pretty-format`'s Immutable.js serializer duck-types on.
 *
 * Enumerated in full rather than by prefix, because the check is an exact property read per marker and a
 * missing one throws exactly like the others.
 */
const IMMUTABLE_MARKERS = [
  '@@__IMMUTABLE_ITERABLE__@@',
  '@@__IMMUTABLE_KEYED__@@',
  '@@__IMMUTABLE_LIST__@@',
  '@@__IMMUTABLE_MAP__@@',
  '@@__IMMUTABLE_ORDERED__@@',
  '@@__IMMUTABLE_RECORD__@@',
  '@@__IMMUTABLE_SEQ__@@',
  '@@__IMMUTABLE_SET__@@',
  '@@__IMMUTABLE_STACK__@@'
];

/**
 * Properties that must yield rather than throw, because test tooling duck-types on them.
 *
 * Every one is read while RENDERING a value, so throwing there replaces a failing assertion's diff with
 * the unmocked-property error and hides what actually differed.
 */
const PASSTHROUGH_PROPS = new Set<string | symbol>([
  '_isMockFunction',
  '$$typeof',
  'asymmetricMatch',
  ...IMMUTABLE_MARKERS,
  'nodeType',
  Symbol.iterator,
  Symbol.toPrimitive,
  Symbol.toStringTag,
  'tagName',
  'then',
  'toJSON'
]);

/**
 * Bypasses strict proxy to access the underlying object.
 *
 * If the object is wrapped in a strict proxy, returns the unwrapped target.
 * Otherwise, returns the object as-is. This allows safely accessing
 * optional properties without triggering the proxy's error on missing props.
 *
 * @typeParam T - The object type.
 * @param $object - The object to bypass.
 * @returns The unwrapped object.
 */
export function bypassStrictProxy<T>($object: T): T {
  if (!isObjectLike($object)) {
    return $object;
  }
  // eslint-disable-next-line unicorn/no-computed-property-existence-check -- On a proxy, `Object.hasOwn` triggers the `getOwnPropertyDescriptor` trap rather than `has`.
  if (!(STRICT_PROXY_TARGET_SYMBOL in $object)) {
    return $object;
  }
  return $object[STRICT_PROXY_TARGET_SYMBOL] as T;
}

/**
 * Creates a strictly-typed mock object from a partial implementation.
 * Uses a `Proxy` that throws a descriptive error when any unmocked
 * property is accessed, preventing silent `undefined` returns.
 *
 * - Idempotent: double-wrapping is a no-op.
 * - Passthrough for well-known props (`then`, `toJSON`, `Symbol.iterator`, etc.).
 * - Recursive proxying of nested plain objects.
 *
 * @typeParam T - The target type to mock.
 * @param partial - A partial object containing only the mocked members.
 * @returns A proxy typed as `T` that throws on unmocked property access.
 */
export function strictProxy<T>(partial: StrictProxyPartial<T>): T {
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
 * @typeParam T - The target type for the proxy.
 * @param value - The value to wrap.
 * @returns The proxied value typed as `T`.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T provides return type inference at call sites.
function wrapProxy<T>(value: unknown): T {
  if (!isObjectLike(value)) {
    return value as T;
  }

  // eslint-disable-next-line unicorn/no-computed-property-existence-check -- On a proxy, `Object.hasOwn` triggers the `getOwnPropertyDescriptor` trap rather than `has`.
  if (STRICT_PROXY_TARGET_SYMBOL in value) {
    return value as T;
  }
  Object.defineProperty(value, STRICT_PROXY_TARGET_SYMBOL, { value });

  const proxiedChildren = new Map<string | symbol>();

  return new Proxy(value, {
    /**
     * Intercepts property access on the proxied object, throwing on unmocked properties.
     *
     * @param target - The proxied target object.
     * @param property - The property being accessed.
     * @param receiver - The proxy or an object that inherits from it.
     * @returns The property value.
     * @remarks Not refactored to parameter-object pattern, to keep the parity with the {@link ProxyHandler.get} trap.
     */
    get(target, property, receiver): unknown {
      // eslint-disable-next-line unicorn/no-computed-property-existence-check -- The `get` trap must see inherited members; `Object.hasOwn` would hide every prototype method.
      if (property in target) {
        if (proxiedChildren.has(property)) {
          return proxiedChildren.get(property);
        }

        const $value: unknown = Reflect.get(target, property, receiver);
        if (isPlainObject($value)) {
          const result = wrapProxy<unknown>($value);
          proxiedChildren.set(property, result);
          return result;
        }
        return $value;
      }

      if (typeof property === 'symbol' || PASSTHROUGH_PROPS.has(property)) {
        return Reflect.get(target, property, receiver);
      }

      throw new Error(`Unmocked property "${property}" was accessed on mock object`);
    }
  }) as T;
}
