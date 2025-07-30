/**
 * @packageDocumentation
 *
 * Type utilities.
 */

/**
 * A type that represents a return value that may be `void`.
 *
 * @typeParam T - The type of the value that may be returned.
 */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type MaybeReturn<T> = T | void;

/**
 * A type that represents the values of an object.
 *
 * @typeParam T - The type of the object.
 */
export type PropertyValues<T extends object> = T[StringKeys<T>];

/**
 * A type that represents the keys of an object as strings.
 *
 * @typeParam T - The type of the object.
 */
export type StringKeys<T extends object> = Extract<keyof T, string>;

type ExactKeys<Type extends object, Keys extends readonly string[]> = keyof Type extends Keys[number] ? Keys[number] extends keyof Type ? Keys
  : `ERROR: Extra keys: ${Exclude<Keys[number], keyof Type> & string}`
  : `ERROR: Missing keys: ${Exclude<keyof Type, Keys[number]> & string}`;

const DUMMY_PROXY = new Proxy(dummyThrow, {
  apply: dummyThrow,
  construct: dummyThrow,
  defineProperty: dummyThrow,
  deleteProperty: dummyThrow,
  get: dummyThrow,
  getOwnPropertyDescriptor: dummyThrow,
  getPrototypeOf: dummyThrow,
  has: dummyThrow,
  isExtensible: dummyThrow,
  ownKeys: dummyThrow,
  preventExtensions: dummyThrow,
  set: dummyThrow,
  setPrototypeOf: dummyThrow
});

/**
 * Asserts that all keys of a type are present in a list of keys.
 *
 * @typeParam Type - The type to assert the keys of.
 * @typeParam Keys - The list of keys to assert.
 * @param _type - The type to assert the keys of.
 * @param keys - The list of keys to assert.
 * @returns The list of keys.
 *
 * @remarks If the incorrect keys are provided, the function has a compile-time error.
 */
export function assertAllTypeKeys<
  Type extends object,
  const Keys extends readonly string[]
>(_type: Type, keys: ExactKeys<Type, Keys>): readonly (keyof Type)[] {
  return Object.freeze(keys.slice()) as readonly (keyof Type)[];
}

/**
 * Converts a type to a dummy parameter.
 *
 * @typeParam T - The type to convert.
 * @returns A dummy parameter of the type.
 *
 * @remarks The result should be used only for type inference. The value should not be used directly.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function typeToDummyParam<T>(): T {
  return DUMMY_PROXY as unknown as T;
}

function dummyThrow(): never {
  throw new Error('Dummy parameter should not be accessed directly.');
}
