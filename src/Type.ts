/**
 * @packageDocumentation
 *
 * Type utilities.
 */

/**
 * A type that represents the keys of an object as strings and asserts that all keys are present in a list of keys.
 *
 * @typeParam Type - The type of the object.
 * @typeParam Keys - The list of keys to assert.
 */
export type ExactKeys<Type extends object, Keys extends readonly string[]> = ExactMembers<StringKeys<Type>, Keys>;

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

type LastInUnion<Union> = UnionToIntersection<Union extends unknown ? () => Union : never> extends () => infer Last ? Last : never;
type UnionToIntersection<Union> = (Union extends unknown ? (key: Union) => void : never) extends (key: infer Intersection) => void ? Intersection : never;
type UnionToTuple<Union, Last = LastInUnion<Union>> = [Union] extends [never] ? [] : [...UnionToTuple<Exclude<Union, Last>>, Last];

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
 * A type that represents the members of a type.
 *
 * @typeParam Type - The type to assert the members of.
 * @typeParam Keys - The list of members to assert.
 */
export type ExactMembers<
  Type extends LiteralKey,
  Keys extends readonly LiteralKey[]
> = Exclude<Keys[number], Type> extends never ? Exclude<Type, Keys[number]> extends never ? Duplicates<Keys> extends [] ? Keys
    : `ERROR: Duplicate members: ${TupleToCSV<Duplicates<Keys>>}`
  : `ERROR: Missing members: ${TupleToCSV<UnionToTuple<Exclude<Type, Keys[number]>>>}`
  : `ERROR: Invalid members: ${TupleToCSV<UnionToTuple<Exclude<Keys[number], Type>>>}`;

type Duplicates<
  T extends readonly unknown[],
  Seen extends readonly unknown[] = [],
  Added extends readonly unknown[] = [],
  Out extends readonly unknown[] = []
> = T extends readonly [infer First, ...infer Rest]
  ? Includes<Seen, First> extends true ? Includes<Added, First> extends true ? Duplicates<Rest, Seen, Added, Out>
    : Duplicates<Rest, Seen, [...Added, First], [...Out, First]>
  : Duplicates<Rest, [...Seen, First], Added, Out>
  : Out;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters,no-magic-numbers
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

type Includes<Type extends readonly unknown[], Member> = Type extends readonly [infer First, ...infer Rest]
  ? Equal<First, Member> extends true ? true : Includes<Rest, Member>
  : false;

type LiteralKey = number | string;

type ToString<T> = T extends number | string ? `${T}` : never;

type TupleToCSV<Tuple extends readonly unknown[]> = Tuple extends readonly [infer First, ...infer Rest]
  ? First extends LiteralKey ? Rest extends readonly unknown[] ? Rest['length'] extends 0 ? ToString<First> : `${ToString<First>},${TupleToCSV<Rest>}`
    : never
  : never
  : '';

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
 *
 * @example
 * ```ts
 * type A = { a: 1, b: 2, c: 3 };
 * assertAllTypeKeys<A>(typeToDummyParam<A>(), ['a', 'b', 'c']); // OK
 * assertAllTypeKeys<A>(typeToDummyParam<A>(), ['c', 'a', 'b']); // OK, order is ignored
 * assertAllTypeKeys<A>(typeToDummyParam<A>(), ['a', 'b', 'c', 'd']); // Error: Invalid members: d
 * assertAllTypeKeys<A>(typeToDummyParam<A>(), ['a', 'b']); // Error: Missing members: c
 * assertAllTypeKeys<A>(typeToDummyParam<A>(), ['a', 'a', 'b', 'c', 'c']); // Error: Duplicate members: a,c
 * ```
 */
export function assertAllTypeKeys<
  Type extends object,
  const Keys extends readonly string[]
>(_type: Type, keys: ExactMembers<StringKeys<Type>, Keys>): readonly (keyof Type)[] {
  return Object.freeze(keys.slice() as (keyof Type)[]);
}

/**
 * Asserts that all members of a union are present in a list of members.
 *
 * @typeParam Type - The type to assert the members of.
 * @typeParam Keys - The list of members to assert.
 * @param _type - The type to assert the members of.
 * @param keys - The list of members to assert.
 * @returns The list of members.
 *
 * @remarks If the incorrect members are provided, the function has a compile-time error.
 *
 * @example
 * ```ts
 * type A = 1 | 2 | 3 | 'a';
 *
 * assertAllUnionMembers(typeToDummyParam<A>(), [1, 2, 3, 'a']); // OK
 * assertAllUnionMembers(typeToDummyParam<A>(), [3, 2, 1, 'a']); // OK, order is ignored
 * assertAllUnionMembers(typeToDummyParam<A>(), [1, 2, 3, 'a', 4]); // Error: Invalid members: 4
 * assertAllUnionMembers(typeToDummyParam<A>(), [1, 2, 3,]); // Error: Missing members: a
 * assertAllUnionMembers(typeToDummyParam<A>(), [1, 2, 3, 'a', 'a']); // Error: Duplicate members: 1,a
 * ```
 */
export function assertAllUnionMembers<
  const Type extends LiteralKey,
  const Keys extends readonly LiteralKey[]
>(_type: Type, keys: ExactMembers<Type, Keys>): readonly Type[] {
  return Object.freeze(keys.slice() as Type[]);
}

/**
 * Converts a type to a dummy parameter.
 *
 * This helper function is useful when we need to get type inference when we cannot use generic type parameters.
 *
 * An example below shows such a scenario.
 *
 * @typeParam T - The type to convert.
 * @returns A dummy parameter of the type.
 *
 * @remarks The result should be used only for type inference. The value should not be used directly.
 *
 * @example
 * ```ts
 * type A = { c: number; };
 * type B = { d: string; }
 *
 * function g<T, U>(u: U) {}
 *
 * // We cannot have partial type inference.
 * g<A>({ d: 'foo' }); // Error: Expected 2 type arguments, but got 1. ts(2558)
 *
 * // We have to call instead
 * g<A, B>({ d: 'foo' }); // OK, but we could not use type inference for `U=B`.
 *
 * function g2<T, U>(_type: T, u: U) {}
 * g2(typeToDummyParam<A>(), { d: 'foo' }); // We could use type inference for `T=A` and `U=B`.
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function typeToDummyParam<T>(): T {
  return DUMMY_PROXY as unknown as T;
}

function dummyThrow(): never {
  throw new Error('Dummy parameter should not be accessed directly.');
}
