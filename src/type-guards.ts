/**
 * @file
 *
 * Contains utility functions for type guards.
 */

import { noop } from './function.ts';

/**
 * A type that represents a generic object.
 *
 * @typeParam T - The base type to intersect with.
 */
export type GenericObject<T = unknown> = Record<string | symbol, unknown> & T;

type NullableConstraint<T> = null extends T ? unknown : undefined extends T ? unknown : never;

/**
 * Asserts that a condition is `true`. Throws if it is not.
 *
 * Use in place of `/* v8 ignore *\/` for defensive guards that should
 * never trigger at runtime but would otherwise create uncovered branches.
 *
 * @param condition - The condition to assert.
 * @param errorOrMessage - The error or message to throw if the condition is `false`.
 */
export function assert(condition: boolean, errorOrMessage: Error | string): asserts condition {
  if (!condition) {
    throw typeof errorOrMessage === 'string' ? new Error(errorOrMessage) : errorOrMessage;
  }
}

/**
 * Asserts that a value is a generic object, narrowing its type in place.
 *
 * @typeParam T - The type of the value.
 * @param _obj - The value to assert.
 */
export function assertGenericObject<T>(_obj: T): asserts _obj is GenericObject<T> {
  noop();
}

/**
 * Asserts at compile time that every case of a discriminated union has been
 * handled. Place at the `default` branch of a `switch` over a union or enum.
 *
 * If a new variant is added to the union without a matching `case`, the call
 * to {@link assertNever} fails to compile because `value` is no longer `never`.
 * If reached at runtime (e.g. because the value was bypassed via JSON or a
 * type assertion), it throws a descriptive `Error`.
 *
 * @example
 * ```ts
 * switch (mode) {
 *   case 'a': return doA();
 *   case 'b': return doB();
 *   default: assertNever(mode);
 * }
 * ```
 *
 * @param value - The exhaustively-handled value, narrowed to `never` by control flow.
 * @throws Always, if reached at runtime.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

/**
 * Asserts that a value is not `null` or `undefined`, narrowing its type in place.
 *
 * Only callable when `T` includes `null` or `undefined`. Passing an already non-nullable type is a compile error.
 *
 * @typeParam T - The type of the value.
 * @param value - The value to check.
 * @param errorOrMessage - Optional {@link Error} or error message string.
 * @throws If the value is `null` or `undefined`.
 */
export function assertNonNullable<T extends NullableConstraint<T>>(value: T, errorOrMessage?: Error | string): asserts value is NonNullable<T> {
  if (value !== null && value !== undefined) {
    return;
  }

  errorOrMessage ??= value === null ? 'Value is null' : 'Value is undefined';
  const error = typeof errorOrMessage === 'string' ? new Error(errorOrMessage) : errorOrMessage;
  throw error;
}

/**
 * Ensures that a value is a generic object, returning it with narrowed type.
 *
 * @typeParam T - The type of the value.
 * @param obj - The value to ensure.
 * @returns The value as a generic object.
 */
export function ensureGenericObject<T>(obj: T): GenericObject<T> {
  return obj as GenericObject<T>;
}

/**
 * Ensures that a value is not `null` or `undefined` and returns it with narrowed type.
 *
 * Only callable when `T` includes `null` or `undefined`. Passing an already non-nullable type is a compile error.
 *
 * @typeParam T - The type of the value.
 * @param value - The value to check.
 * @param errorOrMessage - Optional {@link Error} or error message string.
 * @returns The value with `null` and `undefined` excluded from its type.
 * @throws If the value is `null` or `undefined`.
 */
export function ensureNonNullable<T extends NullableConstraint<T>>(value: T, errorOrMessage?: Error | string): NonNullable<T> {
  assertNonNullable(value, errorOrMessage);
  return value;
}
