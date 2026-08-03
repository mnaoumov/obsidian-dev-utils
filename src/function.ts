/**
 * @file
 *
 * Contains utility functions and types for working with functions.
 */

import type { Promisable } from 'type-fest';

/**
 * Represents a generic async function.
 *
 * @typeParam Arguments - The arguments of the function.
 * @typeParam Return - The awaited return type of the function.
 */
export type GenericAsyncFunction<Arguments extends unknown[] = never[], Return = unknown> = GenericFunction<Arguments, Promise<Return>>;

/**
 * Represents a generic async void function.
 *
 * @typeParam Arguments - The arguments of the function.
 */
export type GenericAsyncVoidFunction<Arguments extends unknown[] = never[]> = GenericAsyncFunction<Arguments, void>;

/**
 * Represents a generic function.
 *
 * @typeParam Arguments - The arguments of the function.
 * @typeParam Return - The return type of the function.
 */
export type GenericFunction<Arguments extends unknown[] = never[], Return = unknown> = (...$arguments: Arguments) => Return;

/**
 * Represents a generic promisable function.
 *
 * @typeParam Arguments - The arguments of the function.
 * @typeParam Return - The awaited return type of the function.
 */
export type GenericPromisableFunction<Arguments extends unknown[] = never[], Return = unknown> = GenericFunction<Arguments, Promisable<Return>>;

/**
 * Represents a generic promisable void function.
 *
 * @typeParam Arguments - The arguments of the function.
 */
export type GenericPromisableVoidFunction<Arguments extends unknown[] = never[]> = GenericPromisableFunction<Arguments, void>;

/**
 * Represents a generic void function.
 *
 * @typeParam Arguments - The arguments of the function.
 */
export type GenericVoidFunction<Arguments extends unknown[] = never[]> = GenericFunction<Arguments, void>;

/**
 * Converts a function into a string that is a valid function expression.
 *
 * `Function.prototype.toString()` on a shorthand method like `{ fn() {} }`
 * returns `"fn() {}"`, which is not a valid expression.
 * This helper detects that form and prefixes it with `function `.
 *
 * @param $function - The function to convert.
 * @returns A string that is a valid function expression.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- We need to use `Function` type.
export function getFunctionExpressionString($function: Function): string {
  const functionString = $function.toString();

  if (FUNCTION_EXPRESSION_RE.test(functionString)) {
    return functionString;
  }

  const asyncMatch = ASYNC_KEYWORD_RE.exec(functionString);
  if (asyncMatch) {
    return `async function ${functionString.slice(asyncMatch[0].length)}`;
  }

  return `function ${functionString}`;
}

/**
 * A function that does nothing.
 */
export function noop(): void {
  // Does nothing.
}

/**
 * A singleton no-op promise.
 */
// eslint-disable-next-line obsidian-dev-utils/prefer-noop-async -- Avoid circular reference.
export const noopAsyncSingletonPromise = Promise.resolve();

/**
 * A function that does nothing.
 *
 * @returns A promise that resolves when the function is complete.
 */
export function noopAsync(): Promise<void> {
  return noopAsyncSingletonPromise;
}

/**
 * Makes an async function that calls the original async function with the provided arguments and omits the return value.
 *
 * @typeParam Arguments - Arguments to be passed to the function.
 * @param $function - Function to be called.
 * @returns An async function that calls the original function with the provided arguments and omits the return value.
 */
export function omitAsyncReturnType<Arguments extends unknown[]>($function: GenericAsyncFunction<Arguments>): GenericAsyncVoidFunction<Arguments> {
  return async (...$arguments: Arguments) => {
    await $function(...$arguments);
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

type ArgumentNamesOf<T extends GenericFunction> = MapToArgumentNames<Parameters<T>>;

interface CreateFunctionArgumentlessParams {
  readonly functionBody: string;
}

interface CreateFunctionParams<TFunction extends GenericFunction> extends CreateFunctionArgumentlessParams {
  readonly argumentNames: ArgumentNamesOf<TFunction>;
}

type MapToArgumentNames<TArguments extends readonly unknown[]> = {
  readonly [K in keyof TArguments]: string;
};

/**
 * Clone a function by creating a new function that calls the original function.
 *
 * This is useful for creating a new instance of a function that has the same behavior but is not strictly equal to the original function.
 *
 * @typeParam TFunction - The type of the function to clone.
 * @param $function - The function to clone.
 * @returns A new function that has the same behavior as the original function.
 */
export function cloneFunction<TFunction extends GenericFunction>($function: TFunction): TFunction {
  return clonedFunction as TFunction;

  function clonedFunction(this: ThisParameterType<TFunction>, ...$arguments: Parameters<TFunction>): ReturnType<TFunction> {
    return $function.apply(this, $arguments) as ReturnType<TFunction>;
  }
}
/**
 * Creates a function from the provided parameters.
 *
 * Function is argumentless, so `argNames` is not needed.
 *
 * @typeParam TFunction - The type of the function to create.
 * @param params - The parameters to create the function with.
 * @returns A function created from the provided parameters.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need return type.
export function createFunction<TFunction extends () => unknown>(params: CreateFunctionArgumentlessParams): TFunction;
/**
 * Creates a function from the provided parameters.
 *
 * Function has arguments, so `argNames` is required.
 *
 * @typeParam TFunction - The type of the function to create.
 * @param params - The parameters to create the function with.
 * @returns A function created from the provided parameters.
 */
export function createFunction<TFunction extends GenericFunction>(params: CreateFunctionParams<TFunction>): TFunction;
/**
 * Creates a function from the provided parameters.
 *
 * @typeParam TFunction - The type of the function to create.
 *
 * @param params - The parameters to create the function with.
 * @returns A function created from the provided parameters.
 */
export function createFunction<TFunction extends GenericFunction>(
  params: CreateFunctionArgumentlessParams & Partial<CreateFunctionParams<TFunction>>
): TFunction {
  const argumentNames = params.argumentNames ?? [];
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval, obsidianmd/rule-custom-message -- Need function constructor
  return new Function(...argumentNames, params.functionBody) as TFunction;
}

/**
 * Makes a function that calls the original function with the provided arguments and omits the return value.
 *
 * @typeParam Arguments - Arguments to be passed to the function.
 * @param $function - Function to be called.
 * @returns A function that calls the original function with the provided arguments and omits the return value.
 */
export function omitReturnType<Arguments extends unknown[]>($function: GenericFunction<Arguments>): GenericVoidFunction<Arguments> {
  return (...$arguments: Arguments) => {
    $function(...$arguments);
  };
}
