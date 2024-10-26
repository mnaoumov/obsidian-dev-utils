/**
 * @packageDocumentation Object
 * Contains utility functions for Objects.
 */

import { throwExpression } from './Error.ts';

/**
 * Compares two values to determine if they are deeply equal.
 *
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns `true` if the values are deeply equal, otherwise `false`.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(aRecord[key], bRecord[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Retrieves the name of a property of a given type `T`.
 *
 * @typeParam T - The type of the object containing the property.
 * @param name - The name of the property as a string.
 * @returns The name of the property.
 */
export function nameof<T>(name: Extract<keyof T, string>): string {
  return name;
}

/**
 * Gets the prototype of the specified object.
 *
 * @typeParam T - The type of the object.
 * @param instance - The object instance to retrieve the prototype of.
 * @returns The prototype of the object.
 */
export function getPrototypeOf<T>(instance: T): T {
  return Object.getPrototypeOf(instance) as T;
}

/**
 * Options for converting an object to JSON.
 */
export interface ToJsonOptions {
  /**
   * If `true`, functions within the value will be handled and included in the JSON string. Defaults to `false`.
   */
  shouldHandleFunctions?: boolean;
  /**
   * Specifies the indentation of the JSON output. This can be a number of spaces or a string. Defaults to `2`.
   */
  space?: string | number | undefined;
}

/**
 * Converts a given value to a JSON string.
 *
 * @param value - The value to be converted to JSON. This can be of any type.
 * @param options - Options for customizing the JSON conversion process.
 * @returns The JSON string representation of the input value.
 */
export function toJson(value: unknown, options: ToJsonOptions = {}): string {
  const {
    shouldHandleFunctions = false,
    space = 2
  } = options;
  if (!shouldHandleFunctions) {
    return JSON.stringify(value, null, space);
  }

  const functionTexts: string[] = [];

  const replacer = (_: string, value: unknown): unknown => {
    if (typeof value === 'function') {
      const index = functionTexts.length;
      functionTexts.push(value.toString());
      return `__FUNCTION_${index.toString()}`;
    }

    return value;
  };

  let json = JSON.stringify(value, replacer, space);
  json = json.replaceAll(/"__FUNCTION_(\d+)"/g, (_, indexStr: string) => functionTexts[parseInt(indexStr)] ?? throwExpression(new Error(`Function with index ${indexStr} not found`)));
  return json;
}

/**
 * Gets the value of a nested property from an object.
 *
 * @param obj - The object to get the nested property value from.
 * @param path - The path to the nested property.
 * @returns The value of the nested property.
 */
export function getNestedPropertyValue(obj: Record<string, unknown>, path: string): unknown {
  let node: Record<string, unknown> | undefined = obj;
  const keys = path.split('.');
  for (const key of keys) {
    if (node === undefined) {
      return undefined;
    }
    node = node[key] as Record<string, unknown> | undefined;
  }

  return node;
}

/**
 * Sets the value of a nested property in an object.
 *
 * @param obj - The object to set the nested property value in.
 * @param path - The path to the nested property.
 * @param value - The value to set.
 */
export function setNestedPropertyValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const error = new Error(`Property path ${path} not found`);
  let node: Record<string, unknown> | undefined = obj;
  const keys = path.split('.');
  for (const key of keys.slice(0, -1)) {
    if (node === undefined) {
      throw error;
    }
    node = node[key] as Record<string, unknown> | undefined;
  }

  const lastKey = keys.at(-1);
  if (node === undefined || lastKey === undefined) {
    throw error;
  }

  node[lastKey] = value;
}
