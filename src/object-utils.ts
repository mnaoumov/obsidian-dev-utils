/**
 * @file
 *
 * Contains utility functions for Objects.
 */

import type {
  Constructor,
  RequiredKeysOf,
  UndefinedOnPartialDeep
} from 'type-fest';

import type { GenericObject } from './type-guards.ts';
import type {
  ExactMembers,
  MaybeReturn,
  StringKeys
} from './type.ts';

import { errorToString } from './error.ts';
import { getFunctionExpressionString } from './function.ts';
import { escapeRegExp } from './reg-exp.ts';
import { replaceAll } from './string.ts';
import {
  assertNever,
  ensureGenericObject,
  ensureNonNullable
} from './type-guards.ts';

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
 * Options for {@link toJson}.
 */
export interface ToJsonOptions {
  /**
   * Specifies how functions should be handled in the JSON output.
   *
   * @default {@link FunctionHandlingMode.Exclude}
   */
  readonly functionHandlingMode: FunctionHandlingMode;

  /**
   * Specifies the maximum depth of nested objects to include in the JSON output.
   * Use `-1` for no limit.
   *
   * @default `-1`
   */
  readonly maxDepth: number;

  /**
   * Specifies whether to catch errors in `toJSON()` and replace them with a placeholder.
   *
   * @default `false`
   */
  readonly shouldCatchToJSONErrors: boolean;

  /**
   * Specifies whether to handle circular references in the JSON output.
   *
   * @default `false`
   */
  readonly shouldHandleCircularReferences: boolean;

  /**
   * Specifies whether to handle errors in the JSON output.
   *
   * @default `false`
   */
  readonly shouldHandleErrors: boolean;

  /**
   * Specifies whether to handle `undefined` values in the JSON output.
   *
   * @default `false`
   */
  readonly shouldHandleUndefined: boolean;

  /**
   * Specifies whether to sort the keys of the JSON output.
   *
   * @default `false`
   */
  readonly shouldSortKeys: boolean;

  /**
   * Specifies the indentation of the JSON output. This can be a number of spaces or a string.
   *
   * @default `2`
   */
  readonly space: number | string;

  /**
   * Specifies the substitutions to use in the JSON output.
   */
  readonly tokenSubstitutions: Partial<TokenSubstitutions>;
}

interface ApplySubstitutionsParams {
  readonly functionTexts: readonly string[];
  readonly index: number;
  readonly key: TokenSubstitutionKey;
  readonly substitutions: TokenSubstitutions;
}

interface EqualityComparerEntry<T> {
  constructor: Constructor<T>;
  equalityComparer(a: T, b: T): boolean;
}

interface JSONSerializable {
  toJSON(...args: unknown[]): unknown;
}

interface ModuleWithDefaultExport<T> {
  default: T;
}

interface ResolvedToJsonOptions extends ToJsonOptions {
  readonly tokenSubstitutions: TokenSubstitutions;
}

interface TokenSubstitutions {
  circularReference: string;
  maxDepthLimitReached: string;
  toJSONFailed: string;
}

const KEY_SEPARATOR = '.';
const PLACEHOLDER_KEY_PREFIX = 'toJson:';
const equalityComparerEntries = createEqualityComparerEntries(
  [
    { constructor: ArrayBuffer, equalityComparer: deepEqualArrayBuffer },
    { constructor: Date, equalityComparer: deepEqualDate },
    { constructor: RegExp, equalityComparer: deepEqualRegExp },
    { constructor: Map, equalityComparer: deepEqualMap },
    { constructor: Set, equalityComparer: deepEqualSet }
  ] as const
);

/**
 * Parameters for {@link setNestedPropertyValue}.
 */
export interface SetNestedPropertyValueParams {
  /**
   * The object to set the nested property value in.
   */
  readonly obj: GenericObject;

  /**
   * The path to the nested property.
   */
  readonly path: string;

  /**
   * The value to set.
   */
  readonly value: unknown;
}

interface HandleArrayParams {
  /**
   * Whether `toJSON()` may be used during conversion.
   */
  readonly canUseToJSON: boolean;

  /**
   * The current recursion depth.
   */
  readonly depth: number;

  /**
   * The array value to convert.
   */
  readonly value: unknown[];
}

interface HandleObjectParams {
  /**
   * Whether `toJSON()` may be used during conversion.
   */
  readonly canUseToJSON: boolean;

  /**
   * The current recursion depth.
   */
  readonly depth: number;

  /**
   * The key under which the value is stored in its parent.
   */
  readonly key: string;

  /**
   * The object value to convert.
   */
  readonly value: object;
}

interface HandlePlainObjectParams {
  /**
   * Whether `toJSON()` may be used during conversion.
   */
  readonly canUseToJSON: boolean;

  /**
   * The current recursion depth.
   */
  readonly depth: number;

  /**
   * The plain object value to convert.
   */
  readonly value: object;
}

type KeysWithUndefined<T> = KeysWithUndefinedMap<T>[keyof T];

type KeysWithUndefinedMap<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never;
};
type MandatoryKeysWithUndefined<T extends object> = Extract<RequiredKeysOf<T> & StringKeys<T>, KeysWithUndefined<T>>;
type RemoveUndefinedOverload<T extends object> = MandatoryKeysWithUndefined<T> extends never ? [obj: T]
  : never;

type RemoveUndefinedWithKeysOverload<T extends object, K extends readonly string[]> = [obj: T, keysToKeep: ExactMembers<MandatoryKeysWithUndefined<T>, K>];

interface ToPlainObjectParams {
  /**
   * Whether `toJSON()` may be used during conversion.
   */
  readonly canUseToJSON: boolean;

  /**
   * The current recursion depth.
   */
  readonly depth: number;

  /**
   * The key under which the value is stored in its parent.
   */
  readonly key: string;

  /**
   * The value to convert.
   */
  readonly value: unknown;
}

/**
 * Parameters for {@link tryEntryEquality}.
 */
interface TryEntryEqualityParams {
  /**
   * The first value to compare.
   */
  readonly a: unknown;

  /**
   * The second value to compare.
   */
  readonly b: unknown;

  /**
   * The equality comparer entry to use.
   */
  readonly entry: EqualityComparerEntry<unknown>;
}

interface TryHandleToJSONParams {
  /**
   * The current recursion depth.
   */
  readonly depth: number;

  /**
   * The key under which the value is stored in its parent.
   */
  readonly key: string;

  /**
   * The object value to convert.
   */
  readonly value: object;
}

/**
 * Converts a value to a JSON-serializable plain object and renders it as a JSON string.
 *
 * A fresh instance is created per {@link toJson} call so that the accumulated `functionTexts`
 * and the `usedObjects` circular-reference set never leak between conversions.
 */
class ToJsonConverter {
  private readonly fullOptions: ResolvedToJsonOptions;
  private readonly functionTexts: string[] = [];
  private readonly usedObjects = new WeakSet();

  /**
   * Creates a new converter, resolving the provided options against the defaults.
   *
   * @param options - The options for the JSON conversion.
   */
  public constructor(options: Partial<ToJsonOptions>) {
    const DEFAULT_OPTIONS: ResolvedToJsonOptions = {
      functionHandlingMode: FunctionHandlingMode.Exclude,
      maxDepth: -1,
      shouldCatchToJSONErrors: false,
      shouldHandleCircularReferences: false,
      shouldHandleErrors: false,
      shouldHandleUndefined: false,
      shouldSortKeys: false,
      // eslint-disable-next-line no-magic-numbers -- Extracting magic number as a constant would be repetitive, as the value is used only once and its name would be the same as the property.
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

    this.fullOptions = fullOptions;
  }

  /**
   * Converts the given value to a JSON string, applying the configured token substitutions.
   *
   * @param value - The value to convert.
   * @returns The JSON string representation of the value.
   */
  public convert(value: unknown): string {
    const plainObject = this.toPlainObject({
      canUseToJSON: true,
      depth: 0,
      key: '',
      value
    });
    let json = ensureNonNullable(JSON.stringify(plainObject, null, this.fullOptions.space));
    const placeholderRegExp = new RegExp(`"\\[\\[${escapeRegExp(PLACEHOLDER_KEY_PREFIX)}(?<Key>[A-Za-z]+)(?<Index>\\d*)\\]\\]"`, 'g');
    json = replaceAll({
      replacer: ({ capturedGroupArgs: [key = '', indexStr = ''] }) =>
        applySubstitutions({
          functionTexts: this.functionTexts,
          index: indexStr ? parseInt(indexStr, 10) : 0,
          key: key as TokenSubstitutionKey,
          substitutions: this.fullOptions.tokenSubstitutions
        }),
      searchValue: placeholderRegExp,
      str: json
    });
    return json;
  }

  private handleArray(params: HandleArrayParams): unknown {
    const {
      canUseToJSON,
      depth,
      value
    } = params;
    if (depth > this.fullOptions.maxDepth) {
      return makePlaceholder(TokenSubstitutionKey.MaxDepthLimitReachedArray, value.length);
    }

    return value.map((item, index) =>
      this.toPlainObject({
        canUseToJSON,
        depth: depth + 1,
        key: String(index),
        value: item
      })
    );
  }

  private handleCircularReference(value: object, key: string): unknown {
    if (this.fullOptions.shouldHandleCircularReferences) {
      return makePlaceholder(TokenSubstitutionKey.CircularReference);
    }
    const valueConstructorName = value.constructor.name || 'Object';
    throw new TypeError(`Converting circular structure to JSON
--> starting at object with constructor '${valueConstructorName}'
--- property '${key}' closes the circle`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type to handle them separately.
  private handleFunction(value: Function): unknown {
    if (this.fullOptions.functionHandlingMode === FunctionHandlingMode.Exclude) {
      return undefined;
    }
    const index = this.functionTexts.length;
    const functionText = this.fullOptions.functionHandlingMode === FunctionHandlingMode.Full
      ? getFunctionExpressionString(value)
      : `function ${value.name || 'anonymous'}() { /* ... */ }`;
    this.functionTexts.push(functionText);
    return makePlaceholder(TokenSubstitutionKey.Function, index);
  }

  private handleObject(params: HandleObjectParams): unknown {
    const {
      canUseToJSON,
      depth,
      key,
      value
    } = params;
    if (this.usedObjects.has(value)) {
      return this.handleCircularReference(value, key);
    }

    this.usedObjects.add(value);

    if (canUseToJSON) {
      const toJSONResult = this.tryHandleToJSON({
        depth,
        key,
        value
      });
      if (toJSONResult !== undefined) {
        return toJSONResult;
      }
    }

    if (Array.isArray(value)) {
      return this.handleArray({
        canUseToJSON,
        depth,
        value
      });
    }

    if (depth > this.fullOptions.maxDepth) {
      return makePlaceholder(TokenSubstitutionKey.MaxDepthLimitReached);
    }

    if (value instanceof Error && this.fullOptions.shouldHandleErrors) {
      return errorToString(value);
    }

    return this.handlePlainObject({
      canUseToJSON,
      depth,
      value
    });
  }

  private handlePlainObject(params: HandlePlainObjectParams): unknown {
    const {
      canUseToJSON,
      depth,
      value
    } = params;
    const entries = Object.entries(value);
    if (this.fullOptions.shouldSortKeys) {
      entries.sort(([key1], [key2]) => key1.localeCompare(key2));
    }

    return Object.fromEntries(
      entries.map(([key2, value2]) => [
        key2,
        this.toPlainObject({
          canUseToJSON,
          depth: depth + 1,
          key: key2,
          value: value2
        })
      ])
    );
  }

  private toPlainObject(params: ToPlainObjectParams): unknown {
    const {
      canUseToJSON,
      depth,
      key,
      value
    } = params;
    if (value === undefined) {
      return (depth === 0 || this.fullOptions.shouldHandleUndefined)
        ? makePlaceholder(TokenSubstitutionKey.Undefined)
        : undefined;
    }

    if (typeof value === 'function') {
      return this.handleFunction(value);
    }

    if (typeof value !== 'object' || value === null) {
      return value;
    }

    return this.handleObject({
      canUseToJSON,
      depth,
      key,
      value
    });
  }

  private tryHandleToJSON(params: TryHandleToJSONParams): unknown {
    const {
      depth,
      key,
      value
    } = params;
    const toJSON = (value as Partial<JSONSerializable>).toJSON;
    if (typeof toJSON === 'function') {
      try {
        const newValue = toJSON.call(value, key);
        return this.toPlainObject({
          canUseToJSON: false,
          depth,
          key,
          value: newValue
        });
      } catch (e) {
        if (this.fullOptions.shouldCatchToJSONErrors) {
          return makePlaceholder(TokenSubstitutionKey.ToJSONFailed);
        }
        throw e;
      }
    }
    return undefined;
  }
}
/**
 * Assigns properties from one or more source objects to a target object, including non-enumerable properties.
 *
 * @typeParam T - The target object type.
 * @typeParam U - The source object type.
 * @param target - The target object to assign properties to.
 * @param source - The source object to assign properties from.
 * @returns The target object with the assigned properties.
 */
export function assignWithNonEnumerableProperties<T extends object, U>(target: T, source: U): T & U;
/**
 * Assigns properties from one or more source objects to a target object, including non-enumerable properties.
 *
 * @typeParam T - The target object type.
 * @typeParam U - The first source object type.
 * @typeParam V - The second source object type.
 * @param target - The target object to assign properties to.
 * @param source1 - The first source object to assign properties from.
 * @param source2 - The second source object to assign properties from.
 * @returns The target object with the assigned properties.
 */
export function assignWithNonEnumerableProperties<T extends object, U, V>(target: T, source1: U, source2: V): T & U & V;
/**
 * Assigns properties from one or more source objects to a target object, including non-enumerable properties.
 *
 * @typeParam T - The target object type.
 * @typeParam U - The first source object type.
 * @typeParam V - The second source object type.
 * @typeParam W - The third source object type.
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
  return assignWithNonEnumerablePropertiesImpl(target, ...sources);
}

/**
 * Casts a value to a specific type.
 *
 * @typeParam T - The target type to cast to.
 * @param value - The value to cast.
 * @returns The value as the specified type.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to cast.
export function castTo<T>(value: unknown): T {
  return value as T;
}

/**
 * Clones an object, including non-enumerable properties.
 *
 * @typeParam T - The type of the object.
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

  const aConstructor = a.constructor;
  const bConstructor = b.constructor;

  if (aConstructor !== bConstructor) {
    return false;
  }

  if (aConstructor !== Object) {
    const result = deepEqualTyped(a, b);
    if (result !== undefined) {
      return result;
    }
  }

  const keysA = getAllKeys(a);
  const keysB = getAllKeys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  const aRecord = ensureGenericObject(a);
  const bRecord = ensureGenericObject(b);

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
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- We have no other way to delete the property.
  delete obj[propertyName];
  return true;
}

/**
 * Extracts the default export from a module.
 *
 * Useful to handle incorrect default export interop between ESM and CJS.
 *
 * @typeParam T - The type of the default export.
 * @param module - The module to extract the default export from.
 * @returns The default export.
 */
export function extractDefaultExportInterop<T>(module: ModuleWithDefaultExport<T> | T): T {
  if (typeof module !== 'object' || module === null) {
    return module;
  }

  if ('default' in module) {
    return module.default;
  }

  return module;
}

/**
 * Gets all entries of an object.
 *
 * @typeParam T - The type of the object.
 * @param obj - The object to get the entries of.
 * @returns An array of all entries of the object.
 */
export function getAllEntries<T extends object>(obj: T): [StringKeys<T>, T[StringKeys<T>]][] {
  return getAllKeys(obj).map((key) => [key, obj[key]]);
}

/**
 * Gets all keys of an object.
 * Includes fields and properties.
 *
 * @typeParam T - The type of the object.
 * @param obj - The object to get the keys of.
 * @returns An array of all keys of the object.
 */
export function getAllKeys<T extends object>(obj: T): StringKeys<T>[] {
  const keys: StringKeys<T>[] = [];
  let current: null | object = obj;
  while (current) {
    const descriptors = Object.getOwnPropertyDescriptors(current);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === '__proto__') {
        continue;
      }

      if (typeof descriptor.value === 'function') {
        continue;
      }

      const hasGetter = typeof descriptor.get === 'function';
      const hasSetter = typeof descriptor.set === 'function';
      if (hasGetter || hasSetter) {
        if (hasGetter && hasSetter) {
          keys.push(key as StringKeys<T>);
        }
        continue;
      }

      if (descriptor.enumerable && descriptor.writable) {
        keys.push(key as StringKeys<T>);
      }
    }

    current = Object.getPrototypeOf(current) as null | object;
  }
  return keys.sort();
}

/**
 * Gets the value of a nested property from an object.
 *
 * @param obj - The object to get the nested property value from.
 * @param path - The path to the nested property.
 * @returns The value of the nested property.
 */
export function getNestedPropertyValue(obj: GenericObject, path: string): unknown {
  let node: GenericObject | undefined = obj;
  const keys = path.split(KEY_SEPARATOR);
  for (const key of keys) {
    if (node === undefined) {
      return undefined;
    }
    node = node[key] as GenericObject | undefined;
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
export function nameof<T extends object>(name: StringKeys<T>): StringKeys<T> {
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
 * Removes all `undefined` properties from an object when there are no mandatory keys with `undefined` values.
 *
 * @typeParam Type - The type of the object.
 * @param args - The arguments to the function.
 * @returns The object with all `undefined` properties removed.
 */
export function removeUndefinedProperties<Type extends object>(
  ...args: RemoveUndefinedOverload<Type>
): Type;
/**
 * Removes all `undefined` properties from an object when there are mandatory keys with `undefined` values.
 *
 * @typeParam Type - The type of the object.
 * @typeParam KeysToKeep - The keys to keep.
 * @param args - The arguments to the function.
 * @returns The object with all `undefined` properties removed.
 */
export function removeUndefinedProperties<Type extends object, const KeysToKeep extends readonly string[]>(
  ...args: RemoveUndefinedWithKeysOverload<Type, KeysToKeep>
): Type;
/**
 * Removes all `undefined` properties from an object.
 *
 * @typeParam Type - The type of the object.
 * @param obj - The object to remove `undefined` properties from.
 * @param keysToKeep - The keys to keep.
 * @returns The object with all `undefined` properties removed.
 */
export function removeUndefinedProperties<Type extends object>(obj: Type, keysToKeep?: readonly string[]): Type {
  for (const [key, value] of Object.entries(obj) as [StringKeys<Type>, unknown][]) {
    if (value === undefined && !keysToKeep?.includes(key)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- We have no other way to delete the property.
      delete obj[key];
    }
  }
  return obj;
}

/**
 * Sets the value of a nested property in an object.
 *
 * @param params - The parameters for setting the nested property value.
 */
export function setNestedPropertyValue(params: SetNestedPropertyValueParams): void {
  const {
    obj,
    path,
    value
  } = params;
  const error = new Error(`Property path ${path} not found`);
  let node: GenericObject | undefined = obj;
  const keys = path.split(KEY_SEPARATOR);
  for (const key of keys.slice(0, -1)) {
    if (node === undefined) {
      throw error;
    }
    node = node[key] as GenericObject | undefined;
  }

  const lastKey = ensureNonNullable(keys.at(-1));
  if (node === undefined) {
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
  return new ToJsonConverter(options).convert(value);
}

function applySubstitutions(params: ApplySubstitutionsParams): MaybeReturn<string> {
  switch (params.key) {
    case TokenSubstitutionKey.CircularReference:
      return params.substitutions.circularReference;
    case TokenSubstitutionKey.Function:
      return ensureNonNullable(params.functionTexts[params.index], `Function with index ${String(params.index)} not found`);
    case TokenSubstitutionKey.MaxDepthLimitReached:
      return params.substitutions.maxDepthLimitReached;
    case TokenSubstitutionKey.MaxDepthLimitReachedArray:
      return `Array(${String(params.index)})`;
    case TokenSubstitutionKey.ToJSONFailed:
      return params.substitutions.toJSONFailed;
    case TokenSubstitutionKey.Undefined:
      return 'undefined';
    /* v8 ignore start -- Exhaustive switch guard; default branch is unreachable. */
    default:
      assertNever(params.key);
      /* v8 ignore stop */
  }
}

function assignWithNonEnumerablePropertiesImpl(target: object, ...sources: object[]): object {
  for (const source of sources) {
    const descriptors = Object.getOwnPropertyDescriptors(source);

    for (const [key, descriptor] of Object.entries(descriptors)) {
      try {
        // Avoid redefining read-only properties (especially `prototype`)
        if (
          key === 'prototype'
          || (Object.getOwnPropertyDescriptor(target, key)?.writable === false
            && !Object.getOwnPropertyDescriptor(target, key)?.configurable)
        ) {
          continue;
        }

        Object.defineProperty(target, key, descriptor);
      } catch {
        // Silently ignore if defineProperty fails
      }
    }
  }

  const sourcePrototypes = sources
    .map((source) => getPrototypeOf<object | undefined>(source))
    .filter((proto): proto is object => !!proto);

  if (sourcePrototypes.length > 0) {
    const targetPrototype = assignWithNonEnumerablePropertiesImpl({}, getPrototypeOf(target), ...sourcePrototypes);

    try {
      Object.setPrototypeOf(target, targetPrototype);
    } catch {
      // Silently ignore if setPrototypeOf fails
    }
  }

  return target;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `unknown` doesn't work, getting compiler errors.
function createEqualityComparerEntries<const T extends readonly EqualityComparerEntry<any>[]>(entries: T): T {
  return entries;
}

function deepEqualArrayBuffer(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }

  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);
  return deepEqual(viewA, viewB);
}

function deepEqualDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function deepEqualMap(a: Map<unknown, unknown>, b: Map<unknown, unknown>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const [key, value] of a.entries()) {
    if (!b.has(key) || !deepEqual(value, b.get(key))) {
      return false;
    }
  }

  return true;
}

function deepEqualRegExp(a: RegExp, b: RegExp): boolean {
  return a.source === b.source && a.flags === b.flags;
}

function deepEqualSet(a: Set<unknown>, b: Set<unknown>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const valueA of a) {
    if (b.has(valueA)) {
      continue;
    }
    let found = false;
    for (const valueB of b) {
      if (deepEqual(valueA, valueB)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }

  return true;
}

function deepEqualTyped(a: unknown, b: unknown): boolean | undefined {
  for (const entry of equalityComparerEntries) {
    const result = tryEntryEquality({
      a,
      b,
      entry
    });
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

function makeObjectTokenSubstitution(key: TokenSubstitutionKey): string {
  return `{ "[[${key}]]": null }`;
}

function makePlaceholder(key: TokenSubstitutionKey, index?: number): string {
  return `[[${PLACEHOLDER_KEY_PREFIX}${key}${index ? String(index) : ''}]]`;
}

function tryEntryEquality(params: TryEntryEqualityParams): boolean | undefined {
  const {
    a,
    b,
    entry
  } = params;
  if (a instanceof entry.constructor && b instanceof entry.constructor) {
    return entry.equalityComparer(a, b);
  }
  return undefined;
}
