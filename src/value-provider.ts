/**
 * @file
 *
 * Contains utility types and functions for handling value providers, which can be either direct values or functions that return values.
 */

import type { Promisable } from 'type-fest';

import { abortSignalNever } from './abort-controller.ts';

/**
 * Value provider that can either be a direct value of type {@link Value} or a function that returns a value of type {@link Value}.
 *
 * @typeParam Value - The type of the value provided.
 * @typeParam Arguments - The types of arguments passed to the function if the provider is a function.
 */
export type ValueProvider<Value, Arguments extends object = object> = (($arguments: Arguments & CommonArguments) => Promisable<Value>) | Value;

interface CommonArguments {
  abortSignal: AbortSignal;
}

/**
 * Resolves a value from a value provider, which can be either a direct value or a function that returns a value.
 *
 * @typeParam Arguments - The types of arguments passed to the function if the provider is a function.
 * @typeParam Value - The type of the value provided.
 * @param provider - The value provider to resolve.
 * @param args - The arguments to pass to the function if the provider is a function.
 * @returns A {@link Promise} that resolves with the value provided by the value provider.
 */
export async function resolveValue<Value, Arguments extends object = object>(
  provider: ValueProvider<Value, Arguments>,
  args: Arguments & Partial<CommonArguments>
): Promise<Value> {
  const fullArguments = { ...args, abortSignal: args.abortSignal ?? abortSignalNever() };
  fullArguments.abortSignal.throwIfAborted();
  if (isFunction(provider)) {
    return await provider(fullArguments);
  }
  return provider;
}

/**
 * Determines whether a given value provider is a function.
 *
 * @typeParam Value - The type of the value provided.
 * @typeParam Arguments - The types of arguments passed to the function if the provider is a function.
 * @param value - The value provider to check.
 * @returns `true` if the value provider is a function, otherwise `false`.
 */
function isFunction<Value, Arguments extends object = object>(value: ValueProvider<Value, Arguments>): value is ($arguments: Arguments & CommonArguments) => Promisable<Value> {
  return typeof value === 'function';
}
