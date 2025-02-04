/**
 * @packageDocumentation Enum
 * Contains utility functions for enums.
 */

/**
 * Get the key of an enum value.
 *
 * @param enumType - The enum type.
 * @param value - The value to get the key of.
 * @returns The key of the enum value.
 */
export function getEnumKey<T extends Record<string, string>>(enumType: T, value: T[keyof T]): keyof T {
  const key = Object.keys(enumType).find((k) => enumType[k] === value);
  if (key === undefined) {
    throw new Error(`Invalid enum value: ${value}`);
  }
  return key as keyof T;
}

/**
 * Get the value of an enum key.
 *
 * @param enumType - The enum type.
 * @param key - The key to get the value of.
 * @returns The value of the enum key.
 */
export function getEnumValue<T extends Record<string, string>>(enumType: T, key: string): T[keyof T] {
  const value = enumType[key];
  if (value === undefined) {
    throw new Error(`Invalid enum key: ${key}`);
  }
  return value as T[keyof T];
}
