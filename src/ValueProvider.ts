/**
 * @packageDocumentation
 *
 * Contains utility types and functions for handling value providers, which can be either direct values or functions that return values.
 */

import type { Promisable } from 'type-fest';
/**
 * Represents a value provider that can either be a direct value of type `Value` or a function that returns a value of type `Value`.
 *
 * @typeParam Value - The type of the value provided.
 * @typeParam Args - The types of arguments passed to the function if the provider is a function.
 */
export type ValueProvider<Value, Args extends unknown[] = []> = ((...args: Args) => Promisable<Value>) | Value;

/**
 * Resolves a value from a value provider, which can be either a direct value or a function that returns a value.
 *
 * @typeParam Args - The types of arguments passed to the function if the provider is a function.
 * @typeParam Value - The type of the value provided.
 * @param provider - The value provider to resolve.
 * @param args - The arguments to pass to the function if the provider is a function.
 * @returns A {@link Promise} that resolves with the value provided by the value provider.
 */
export async function resolveValue<Value, Args extends unknown[]>(provider: ValueProvider<Value, Args>, ...args: Args): Promise<Value> {
  if (isFunction(provider)) {
    return await provider(...args);
  }
  return provider;
}

/**
 * Determines whether a given value provider is a function.
 *
 * @typeParam Value - The type of the value provided.
 * @typeParam Args - The types of arguments passed to the function if the provider is a function.
 * @param value - The value provider to check.
 * @returns `true` if the value provider is a function, otherwise `false`.
 */
function isFunction<Value, Args extends unknown[]>(value: ValueProvider<Value, Args>): value is (...args: Args) => Promisable<Value> {
  return typeof value === 'function';
}
