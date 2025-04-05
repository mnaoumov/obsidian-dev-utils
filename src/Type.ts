/**
 * A type that represents a return value that may be `void`.
 *
 * @typeParam T - The type of the value that may be returned.
 */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type MaybeReturn<T> = T | void;

/**
 * A type that represents the keys of an object as strings.
 *
 * @typeParam T - The type of the object.
 */
export type StringKeys<T extends object> = Extract<keyof T, string>;
