/**
 * @packageDocumentation
 *
 * Type utilities.
 */

import { castTo } from './object-utils.ts';

/**
 * A type that represents the keys of an object as strings and asserts that all keys are present in a list of keys.
 *
 * @typeParam Type - The type of the object.
 * @typeParam Keys - The list of keys to assert.
 */
export type ExactKeys<Type extends object, Keys extends readonly string[]> = ExactMembers<StringKeys<Type>, Keys>;

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

/**
 * A type that represents a return value that may be `void`.
 *
 * @typeParam T - The type of the value that may be returned.
 */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- We need to use the `void` return type.
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

/**
 * A helper that captures a type parameter and provides methods for compile-time exhaustiveness checks.
 *
 * @typeParam Type - The captured type.
 *
 * @remarks
 * - `assertAllKeys` is available when `Type` is an object type.
 * - `assertAllMembers` is available when `Type` is a literal key union (`string | number`).
 *
 * @example
 * ```ts
 * type A = { a: 1, b: 2, c: 3 };
 * typeAsserter<A>().assertAllKeys(['a', 'b', 'c']); // OK
 * typeAsserter<A>().assertAllKeys(['c', 'a', 'b']); // OK, order is ignored
 * typeAsserter<A>().assertAllKeys(['a', 'b', 'c', 'd']); // Error: Invalid members: d
 * typeAsserter<A>().assertAllKeys(['a', 'b']); // Error: Missing members: c
 *
 * type B = 1 | 2 | 3 | 'a';
 * typeAsserter<B>().assertAllMembers([1, 2, 3, 'a']); // OK
 * typeAsserter<B>().assertAllMembers([1, 2, 3, 'a', 4]); // Error: Invalid members: 4
 * typeAsserter<B>().assertAllMembers([1, 2, 3]); // Error: Missing members: a
 * ```
 */
export interface TypeAsserter<Type> {
  /**
   * Asserts that all keys of an object type are present in a list of keys.
   *
   * @remarks Only available when `[Type] extends [object]`.
   */
  assertAllKeys: [Type] extends [object] ? <const Keys extends readonly string[]>(
      keys: ExactMembers<StringKeys<Type>, Keys>
    ) => readonly (keyof Type)[]
    : never;

  /**
   * Asserts that all members of a union type are present in a list of members.
   *
   * @remarks Only available when `[Type] extends [LiteralKey]`.
   */
  assertAllMembers: [Type] extends [LiteralKey] ? <const Keys extends readonly LiteralKey[]>(
      keys: ExactMembers<Type, Keys>
    ) => readonly Type[]
    : never;
}
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
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters,no-magic-numbers -- We need to use the dummy parameter to get type inference.
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

type Includes<Type extends readonly unknown[], Member> = Type extends readonly [infer First, ...infer Rest]
  ? Equal<First, Member> extends true ? true : Includes<Rest, Member>
  : false;

type LastInUnion<Union> = UnionToIntersection<Union extends unknown ? () => Union : never> extends () => infer Last ? Last : never;

type LiteralKey = number | string;

type ToString<T> = T extends number | string ? `${T}` : never;

type TupleToCSV<Tuple extends readonly unknown[]> = Tuple extends readonly [infer First, ...infer Rest]
  ? First extends LiteralKey ? Rest extends readonly unknown[] ? Rest['length'] extends 0 ? ToString<First> : `${ToString<First>},${TupleToCSV<Rest>}`
    : never
  : never
  : '';

type UnionToIntersection<Union> = (Union extends unknown ? (key: Union) => void : never) extends (key: infer Intersection) => void ? Intersection : never;

type UnionToTuple<Union, Last = LastInUnion<Union>> = [Union] extends [never] ? [] : [...UnionToTuple<Exclude<Union, Last>>, Last];

/**
 * Creates a type helper that captures a type parameter for compile-time exhaustiveness checks.
 *
 * @typeParam Type - The type to capture.
 * @returns A {@link TypeAsserter} with `assertAllKeys` and `assertAllMembers` methods.
 *
 * @example
 * ```ts
 * type A = { a: 1, b: 2, c: 3 };
 * typeAsserter<A>().assertAllKeys(['a', 'b', 'c']); // OK
 * typeAsserter<A>().assertAllKeys(['c', 'a', 'b']); // OK, order is ignored
 *
 * type B = 1 | 2 | 3 | 'a';
 * typeAsserter<B>().assertAllMembers([1, 2, 3, 'a']); // OK
 * ```
 */
export function typeAsserter<Type>(): TypeAsserter<Type> {
  return castTo<TypeAsserter<Type>>({
    assertAllKeys<const Keys extends readonly string[]>(
      keys: ExactMembers<StringKeys<object & Type>, Keys>
    ): readonly (keyof (object & Type))[] {
      return Object.freeze(keys.slice() as (keyof (object & Type))[]);
    },
    assertAllMembers<const Keys extends readonly LiteralKey[]>(
      keys: ExactMembers<LiteralKey & Type, Keys>
    ): readonly (LiteralKey & Type)[] {
      return Object.freeze(keys.slice() as (LiteralKey & Type)[]);
    }
  });
}
