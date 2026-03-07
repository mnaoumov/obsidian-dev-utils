/**
 * @packageDocumentation
 *
 * Test helper utilities shared across test files.
 */

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
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T provides return type inference at call sites.
export function createMockOf<T>(partial: unknown): T {
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
        const result = createMockOf(value);
        proxiedChildren.set(prop, result);
        return result;
      }
      return value;
    }
  }) as T;
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
