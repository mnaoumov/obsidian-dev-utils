/**
 * @packageDocumentation
 *
 * Contains utility functions for enums.
 */

import { ensureNonNullable } from './ObjectUtils.ts';

/**
 * Get the key of an enum value.
 *
 * @param enumType - The enum type.
 * @param value - The value to get the key of.
 * @returns The key of the enum value.
 */
export function getEnumKey<T extends Record<string, string>>(enumType: T, value: T[keyof T]): keyof T {
  return ensureNonNullable(Object.keys(enumType).find((k) => enumType[k] === value), `Invalid enum value: ${value}`) as keyof T;
}

/**
 * Get the value of an enum key.
 *
 * @param enumType - The enum type.
 * @param key - The key to get the value of.
 * @returns The value of the enum key.
 */
export function getEnumValue<T extends Record<string, string>>(enumType: T, key: string): T[keyof T] {
  return ensureNonNullable(enumType[key], `Invalid enum key: ${key}`) as T[keyof T];
}
