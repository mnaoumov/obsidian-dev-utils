/**
 * @module @types
 * Contains utility types for working with TypeScript classes and type properties.
 */

/**
 * Represents a constructor type for a given class `T` with arguments `Args`.
 *
 * @template Type - The type of the instance being constructed.
 * @template Args - The types of arguments the constructor accepts.
 */
export type Constructor<Type, Args extends unknown[] = []> = new (...args: Args) => Type;

/**
 * Extracts the keys of a given type `Type` that match a specific value type `Value`.
 *
 * @template Type - The type from which to extract the keys.
 * @template Value - The value type to match against.
 */
export type KeysMatching<Type, Value> = { [Key in keyof Type]-?: Type[Key] extends Value ? Key : never }[keyof Type];
