/**
 * @file
 *
 * Contains utility functions and types for working with functions.
 */

import type { Promisable } from 'type-fest';

/**
 * Represents a generic async function.
 *
 * @typeParam Args - The arguments of the function.
 * @typeParam Return - The awaited return type of the function.
 */
export type GenericAsyncFunction<Args extends unknown[] = never[], Return = unknown> = GenericFunction<Args, Promise<Return>>;

/**
 * Represents a generic async void function.
 *
 * @typeParam Args - The arguments of the function.
 */
export type GenericAsyncVoidFunction<Args extends unknown[] = never[]> = GenericAsyncFunction<Args, void>;

/**
 * Represents a generic function.
 *
 * @typeParam Args - The arguments of the function.
 * @typeParam Return - The return type of the function.
 */
export type GenericFunction<Args extends unknown[] = never[], Return = unknown> = (...args: Args) => Return;

/**
 * Represents a generic promisable function.
 *
 * @typeParam Args - The arguments of the function.
 * @typeParam Return - The awaited return type of the function.
 */
export type GenericPromisableFunction<Args extends unknown[] = never[], Return = unknown> = GenericFunction<Args, Promisable<Return>>;

/**
 * Represents a generic promisable void function.
 *
 * @typeParam Args - The arguments of the function.
 */
export type GenericPromisableVoidFunction<Args extends unknown[] = never[]> = GenericPromisableFunction<Args, void>;

/**
 * Represents a generic void function.
 *
 * @typeParam Args - The arguments of the function.
 */
export type GenericVoidFunction<Args extends unknown[] = never[]> = GenericFunction<Args, void>;

/**
 * Converts a function into a string that is a valid function expression.
 *
 * `Function.prototype.toString()` on a shorthand method like `{ fn() {} }`
 * returns `"fn() {}"`, which is not a valid expression.
 * This helper detects that form and prefixes it with `function `.
 *
 * @param fn - The function to convert.
 * @returns A string that is a valid function expression.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type.
export function getFunctionExpressionString(fn: Function): string {
  const fnString = fn.toString();

  if (FUNCTION_EXPRESSION_RE.test(fnString)) {
    return fnString;
  }

  const asyncMatch = ASYNC_KEYWORD_RE.exec(fnString);
  if (asyncMatch) {
    return `async function ${fnString.slice(asyncMatch[0].length)}`;
  }

  return `function ${fnString}`;
}

/**
 * A function that does nothing.
 */
export function noop(): void {
  // Does nothing.
}

/**
 * A function that does nothing.
 */
export async function noopAsync(): Promise<void> {
  // Does nothing.
}

/**
 * Makes an async function that calls the original async function with the provided arguments and omits the return value.
 *
 * @typeParam Args - Arguments to be passed to the function.
 * @param fn - Function to be called.
 * @returns An async function that calls the original function with the provided arguments and omits the return value.
 */
export function omitAsyncReturnType<Args extends unknown[]>(fn: GenericAsyncFunction<Args>): GenericAsyncVoidFunction<Args> {
  return async (...args: Args) => {
    await fn(...args);
  };
}

/**
 * Matches strings that are already valid function expressions:
 * - `function ...` (keyword, not identifier like `function1`)
 * - `(` (arrow function)
 * - `async\b` followed by `function\b` or `(` (async function/arrow)
 */
const FUNCTION_EXPRESSION_RE = /^(?:function\b|async\b\s*(?:function\b|\()|\()/;

/**
 * Matches the `async` keyword (word boundary, not `async1`) followed by optional whitespace.
 * Used to strip the `async` prefix from async shorthand methods before re-adding `async function`.
 */
const ASYNC_KEYWORD_RE = /^async\b\s*/;

/**
 * Makes a function that calls the original function with the provided arguments and omits the return value.
 *
 * @typeParam Args - Arguments to be passed to the function.
 * @param fn - Function to be called.
 * @returns A function that calls the original function with the provided arguments and omits the return value.
 */
export function omitReturnType<Args extends unknown[]>(fn: GenericFunction<Args>): GenericVoidFunction<Args> {
  return (...args: Args) => {
    fn(...args);
  };
}
