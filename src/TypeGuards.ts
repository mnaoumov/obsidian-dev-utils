/**
 * @packageDocumentation
 *
 * Contains utility functions for type guards.
 */

import { noop } from './Function.ts';

/**
 * A type that represents a generic object.
 */
export type GenericObject = Record<string, unknown>;

type NullableConstraint<T> = null extends T ? unknown : undefined extends T ? unknown : never;

/**
 * Asserts that a value is a generic object, narrowing its type in place.
 *
 * @param _obj - The value to assert.
 */
export function assertGenericObject(_obj: object): asserts _obj is GenericObject {
  noop();
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
 * @param obj - The value to ensure.
 * @returns The value as a generic object.
 */
export function ensureGenericObject(obj: object): GenericObject {
  return obj as GenericObject;
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
