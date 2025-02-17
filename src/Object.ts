/**
 * @packageDocumentation Object
 * Contains utility functions for Objects.
 */

import type { UndefinedOnPartialDeep } from 'type-fest';

import {
  errorToString,
  throwExpression
} from './Error.ts';
import { replaceAll } from './String.ts';

/**
 * Specifies how functions should be handled in the JSON output.
 */
export enum FunctionHandlingMode {
  /**
   * Excludes functions from the JSON output.
   */
  Exclude = 'exclude',
  /**
   * Includes the full function definition in the JSON output.
   */
  Full = 'full',
  /**
   * Includes only the function name in the JSON output.
   */
  NameOnly = 'nameOnly'
}

enum TokenSubstitutionKey {
  CircularReference = 'CircularReference',
  Function = 'Function',
  MaxDepthLimitReached = 'MaxDepthLimitReached',
  MaxDepthLimitReachedArray = 'MaxDepthLimitReachedArray',
  ToJSONFailed = 'ToJSONFailed',
  Undefined = 'Undefined'
}

/**
 * Represents a constructor type for a given class `T` with arguments `Args`.
 *
 * @typeParam Type - The type of the instance being constructed.
 * @typeParam Args - The types of arguments the constructor accepts.
 */
export type Constructor<Type, Args extends unknown[] = []> = new (...args: Args) => Type;

/**
 * Extracts the keys of a given type `Type` that match a specific value type `Value`.
 *
 * @typeParam Type - The type from which to extract the keys.
 * @typeParam Value - The value type to match against.
 */
export type KeysMatching<Type, Value> = { [Key in keyof Type]-?: Type[Key] extends Value ? Key : never }[keyof Type];

/**
 * Options for converting an object to JSON.
 */
export interface ToJsonOptions {
  /**
   * Specifies how functions should be handled in the JSON output (default: `exclude`).
   */
  functionHandlingMode: FunctionHandlingMode;
  /**
   * Specifies the maximum depth of nested objects to include in the JSON output.
   * Use `-1` for no limit.
   * Defaults to `-1`.
   */
  maxDepth: number;
  /**
   * Specifies whether to catch errors in `toJSON()` and replace them with a placeholder.
   * Defaults to `false`.
   */
  shouldCatchToJSONErrors: boolean;
  /**
   * Specifies whether to handle circular references in the JSON output.
   * Defaults to `false`.
   */
  shouldHandleCircularReferences: boolean;
  /**
   * Specifies whether to handle errors in the JSON output.
   * Defaults to `false`.
   */
  shouldHandleErrors: boolean;
  /**
   * Specifies whether to handle undefined values in the JSON output.
   * Defaults to `false`.
   */
  shouldHandleUndefined: boolean;
  /**
   * Specifies whether to sort the keys of the JSON output.
   * Defaults to `false`.
   */
  shouldSortKeys: boolean;
  /**
   * Specifies the indentation of the JSON output. This can be a number of spaces or a string. Defaults to `2`.
   */
  space: number | string;
  /**
   * Specifies the substitutions to use in the JSON output.
   */
  tokenSubstitutions: Partial<TokenSubstitutions>;
}

interface ApplySubstitutionsOptions {
  functionTexts: string[];
  index: number;
  key: TokenSubstitutionKey;
  substitutions: TokenSubstitutions;
}

interface JSONSerializable {
  toJSON(...args: unknown[]): unknown;
}

interface TokenSubstitutions {
  circularReference: string;
  maxDepthLimitReached: string;
  toJSONFailed: string;
}

const KEY_SEPARATOR = '.';

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
 * Deletes multiple properties from an object.
 *
 * @typeParam T - The type of the object.
 * @param obj - The object to delete the properties from.
 * @param propertyNames - The names of the properties to delete.
 * @returns `true` if any of the properties were present, otherwise `false`.
 */
export function deleteProperties<T extends object>(obj: T, propertyNames: (keyof T)[]): boolean {
  let ans = false;

  for (const propertyName of propertyNames) {
    ans = deleteProperty(obj, propertyName) || ans;
  }

  return ans;
}

/**
 * Deletes a property from an object.
 *
 * @typeParam T - The type of the object.
 * @param obj - The object to delete the property from.
 * @param propertyName - The name of the property to delete.
 * @returns `true` if the property was present, otherwise `false`.
 */
export function deleteProperty<T extends object>(obj: T, propertyName: keyof T): boolean {
  if (!Object.hasOwn(obj, propertyName)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete obj[propertyName];
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
  const keys = path.split(KEY_SEPARATOR);
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
 * Normalizes optional properties to allow `undefined` assignment in strict mode.
 *
 * This utility provides a workaround for the `exactOptionalPropertyTypes` TypeScript flag,
 * which prohibits directly assigning `undefined` to optional properties when the type
 * explicitly omits `undefined`.
 *
 * Example:
 * ```typescript
 * // With `exactOptionalPropertyTypes: true`
 * const x: { prop?: string } = { prop: undefined }; // Compiler error
 *
 * // Using this utility:
 * const y: { prop?: string } = normalizeOptionalProperties<{ prop?: string }>({ prop: undefined }); // Works
 * ```
 *
 * @typeParam T - The target type with optional properties to normalize.
 * @param obj - The object to normalize, allowing explicit `undefined` for optional properties.
 * @returns The normalized object, compatible with `exactOptionalPropertyTypes`.
 */
export function normalizeOptionalProperties<T>(obj: UndefinedOnPartialDeep<T>): T {
  return obj as T;
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
  const keys = path.split(KEY_SEPARATOR);
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
export function toJson(value: unknown, options: Partial<ToJsonOptions> = {}): string {
  const DEFAULT_OPTIONS: { tokenSubstitutions: TokenSubstitutions } & ToJsonOptions = {
    functionHandlingMode: FunctionHandlingMode.Exclude,
    maxDepth: -1,
    shouldCatchToJSONErrors: false,
    shouldHandleCircularReferences: false,
    shouldHandleErrors: false,
    shouldHandleUndefined: false,
    shouldSortKeys: false,
    // eslint-disable-next-line no-magic-numbers
    space: 2,
    tokenSubstitutions: {
      circularReference: makeObjectTokenSubstitution(TokenSubstitutionKey.CircularReference),
      maxDepthLimitReached: makeObjectTokenSubstitution(TokenSubstitutionKey.MaxDepthLimitReached),
      toJSONFailed: makeObjectTokenSubstitution(TokenSubstitutionKey.ToJSONFailed)
    }
  };

  const fullOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    tokenSubstitutions: {
      ...DEFAULT_OPTIONS.tokenSubstitutions,
      ...options.tokenSubstitutions
    }
  };

  if (fullOptions.maxDepth === -1) {
    fullOptions.maxDepth = Infinity;
  }

  const functionTexts: string[] = [];
  const usedObjects = new WeakSet<object>();

  const plainObject = toPlainObject(value, '', 0, true, fullOptions, functionTexts, usedObjects);
  let json = JSON.stringify(plainObject, null, fullOptions.space) ?? '';
  json = replaceAll(json, /"\[\[(?<Key>[A-Za-z]+)(?<Index>\d*)\]\]"/g, (_, key, indexStr) =>
    applySubstitutions({
      functionTexts,
      index: indexStr ? parseInt(indexStr, 10) : 0,
      key: key as TokenSubstitutionKey,
      substitutions: fullOptions.tokenSubstitutions
    }));
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

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function applySubstitutions(options: ApplySubstitutionsOptions): string | void {
  switch (options.key) {
    case TokenSubstitutionKey.CircularReference:
      return options.substitutions.circularReference;
    case TokenSubstitutionKey.Function:
      return options.functionTexts[options.index] ?? throwExpression(new Error(`Function with index ${options.index.toString()} not found`));
    case TokenSubstitutionKey.MaxDepthLimitReached:
      return options.substitutions.maxDepthLimitReached;
    case TokenSubstitutionKey.MaxDepthLimitReachedArray:
      return `Array(${options.index.toString()})`;
    case TokenSubstitutionKey.ToJSONFailed:
      return options.substitutions.toJSONFailed;
    case TokenSubstitutionKey.Undefined:
      return 'undefined';
    default:
      break;
  }
}

function handleArray(
  value: unknown[],
  depth: number,
  canUseToJSON: boolean,
  fullOptions: ToJsonOptions,
  functionTexts: string[],
  usedObjects: WeakSet<object>
): unknown {
  if (depth > fullOptions.maxDepth) {
    return makePlaceholder(TokenSubstitutionKey.MaxDepthLimitReachedArray, value.length);
  }

  return value.map((item, index) => toPlainObject(item, index.toString(), depth + 1, canUseToJSON, fullOptions, functionTexts, usedObjects));
}

function handleCircularReference(value: object, key: string, fullOptions: ToJsonOptions): unknown {
  if (fullOptions.shouldHandleCircularReferences) {
    return makePlaceholder(TokenSubstitutionKey.CircularReference);
  }
  const valueConstructorName = value.constructor.name || 'Object';
  throw new TypeError(`Converting circular structure to JSON
--> starting at object with constructor '${valueConstructorName}'
--- property '${key}' closes the circle`);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function handleFunction(value: Function, functionTexts: string[], fullOptions: ToJsonOptions): unknown {
  if (fullOptions.functionHandlingMode === FunctionHandlingMode.Exclude) {
    return undefined;
  }
  const index = functionTexts.length;
  const functionText = fullOptions.functionHandlingMode === FunctionHandlingMode.Full
    ? value.toString()
    : `function ${value.name || 'anonymous'}() { /* ... */ }`;
  functionTexts.push(functionText);
  return makePlaceholder(TokenSubstitutionKey.Function, index);
}

function handleObject(
  value: object,
  key: string,
  depth: number,
  canUseToJSON: boolean,
  fullOptions: ToJsonOptions,
  functionTexts: string[],
  usedObjects: WeakSet<object>
): unknown {
  if (usedObjects.has(value)) {
    return handleCircularReference(value, key, fullOptions);
  }

  usedObjects.add(value);

  if (canUseToJSON) {
    const toJSONResult = tryHandleToJSON(value, key, depth, fullOptions, functionTexts, usedObjects);
    if (toJSONResult !== undefined) {
      return toJSONResult;
    }
  }

  if (Array.isArray(value)) {
    return handleArray(value, depth, canUseToJSON, fullOptions, functionTexts, usedObjects);
  }

  if (depth > fullOptions.maxDepth) {
    return makePlaceholder(TokenSubstitutionKey.MaxDepthLimitReached);
  }

  if (value instanceof Error && fullOptions.shouldHandleErrors) {
    return errorToString(value);
  }

  return handlePlainObject(value, depth, canUseToJSON, fullOptions, functionTexts, usedObjects);
}

function handlePlainObject(
  value: object,
  depth: number,
  canUseToJSON: boolean,
  fullOptions: ToJsonOptions,
  functionTexts: string[],
  usedObjects: WeakSet<object>
): unknown {
  const entries = Object.entries(value);
  if (fullOptions.shouldSortKeys) {
    entries.sort(([key1], [key2]) => key1.localeCompare(key2));
  }

  return Object.fromEntries(
    entries.map(([key2, value2]) => [
      key2,
      toPlainObject(value2, key2, depth + 1, canUseToJSON, fullOptions, functionTexts, usedObjects)
    ])
  );
}

function makeObjectTokenSubstitution(key: TokenSubstitutionKey): string {
  return `{ "[[${key}]]": null }`;
}

function makePlaceholder(key: TokenSubstitutionKey, index?: number): string {
  return `[[${key}${index?.toString() ?? ''}]]`;
}

function toPlainObject(
  value: unknown,
  key: string,
  depth: number,
  canUseToJSON: boolean,
  fullOptions: ToJsonOptions,
  functionTexts: string[],
  usedObjects: WeakSet<object>
): unknown {
  if (value === undefined) {
    return (depth === 0 || fullOptions.shouldHandleUndefined)
      ? makePlaceholder(TokenSubstitutionKey.Undefined)
      : undefined;
  }

  if (typeof value === 'function') {
    return handleFunction(value, functionTexts, fullOptions);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return handleObject(value, key, depth, canUseToJSON, fullOptions, functionTexts, usedObjects);
}

function tryHandleToJSON(
  value: object,
  key: string,
  depth: number,
  fullOptions: ToJsonOptions,
  functionTexts: string[],
  usedObjects: WeakSet<object>
): unknown {
  const toJSON = (value as Partial<JSONSerializable>).toJSON;
  if (typeof toJSON === 'function') {
    try {
      const newValue = toJSON.call(value, key);
      return toPlainObject(newValue, key, depth, false, fullOptions, functionTexts, usedObjects);
    } catch (e) {
      if (fullOptions.shouldCatchToJSONErrors) {
        return makePlaceholder(TokenSubstitutionKey.ToJSONFailed);
      }
      throw e;
    }
  }
  return undefined;
}
