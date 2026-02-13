import { expect } from 'vitest';

/**
 * Asserts that a value is not `null` or `undefined`, narrowing its type for subsequent usage.
 *
 * @param value - The value to assert.
 * @throws {ExpectationError} If the value is `null` or `undefined`.
 */
export function assertNotNullable<T>(value: T): asserts value is NonNullable<T> {
  expect(value).not.toBeNull();
  expect(value).not.toBeUndefined();
}
