/**
 * @packageDocumentation Object
 * Contains utility functions for Objects.
 */

import { throwExpression } from './Error.ts';

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
  space?: number | string | undefined;
}

/**
 * Assigns properties from one or more source objects to a target object, including non-enumerable properties.
 *
 * @param target - The target object to assign properties to.
 * @param source - The source object to assign properties from.
 * @returns The target object with the assigned properties.
 */
export function assignWithNonEnumerableProperties<T extends object, U>(target: T, source: U): T & U;

/**
 * @param target - The target object to assign properties to.
 * @param source1 - The first source object to assign properties from.
 * @param source2 - The second source object to assign properties from.
 * @returns The target object with the assigned properties.
 */
export function assignWithNonEnumerableProperties<T extends object, U, V>(target: T, source1: U, source2: V): T & U & V;

/**
 * Assigns properties from one or more source objects to a target object, including non-enumerable properties.
 *
 * @param target - The target object to assign properties to.
 * @param source1 - The first source object to assign properties from.
 * @param source2 - The second source object to assign properties from.
 * @param source3 - The third source object to assign properties from.
 * @returns The target object with the assigned properties.
 */
export function assignWithNonEnumerableProperties<T extends object, U, V, W>(target: T, source1: U, source2: V, source3: W): T & U & V & W;

/**
 * Assigns properties from one or more source objects to a target object, including non-enumerable properties.
 *
 * @param target - The target object to assign properties to.
 * @param sources - The source objects to assign properties from.
 * @returns The target object with the assigned properties.
 */
export function assignWithNonEnumerableProperties(target: object, ...sources: object[]): object {
  return _assignWithNonEnumerableProperties(target, ...sources);
}

/**
 * Clones an object, including non-enumerable properties.
 *
 * @param obj - The object to clone.
 * @returns A new object with the same properties as the original object, including non-enumerable properties.
 */
export function cloneWithNonEnumerableProperties<T extends object>(obj: T): T {
  return Object.create(getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj)) as T;
}

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
 * Gets the prototype of the specified object.
 *
 * @typeParam T - The type of the object.
 * @param instance - The object instance to retrieve the prototype of.
 * @returns The prototype of the object.
 */
export function getPrototypeOf<T>(instance: T): T {
  if (instance === undefined || instance === null) {
    return instance;
  }
  return Object.getPrototypeOf(instance) as T;
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

function _assignWithNonEnumerableProperties(target: object, ...sources: object[]): object {
  for (const source of sources) {
    Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
  }

  const sourcePrototypes = (sources.map((source) => getPrototypeOf(source)) as (null | object)[]).filter<null | object>((proto) => !!proto) as object[];

  if (sourcePrototypes.length > 0) {
    const targetPrototype = _assignWithNonEnumerableProperties({}, getPrototypeOf(target), ...sourcePrototypes);
    Object.setPrototypeOf(target, targetPrototype);
  }

  return target;
}
