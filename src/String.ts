/**
 * @fileoverview Contains utility functions for string operations.
 */

import {
  resolveValue,
  type ValueProvider
} from "./ValueProvider.ts";

type AsyncReplacer<Args extends unknown[]> = ValueProvider<string, [string, ...Args]>;

/**
 * Trims the specified prefix from the start of a string.
 *
 * @param str - The string to trim.
 * @param prefix - The prefix to remove from the start of the string.
 * @param validate - If true, throws an error if the string does not start with the prefix.
 * @returns The trimmed string.
 * @throws If `validate` is true and the string does not start with the prefix.
 */
export function trimStart(str: string, prefix: string, validate?: boolean): string {
  if (str.startsWith(prefix)) {
    return str.slice(prefix.length);
  }

  if (validate) {
    throw new Error(`String ${str} does not start with prefix ${prefix}`);
  }

  return str;
}

/**
 * Trims the specified suffix from the end of a string.
 *
 * @param str - The string to trim.
 * @param suffix - The suffix to remove from the end of the string.
 * @param validate - If true, throws an error if the string does not end with the suffix.
 * @returns The trimmed string.
 * @throws If `validate` is true and the string does not end with the suffix.
 */
export function trimEnd(str: string, suffix: string, validate?: boolean): string {
  if (str.endsWith(suffix)) {
    return str.slice(0, -suffix.length);
  }

  if (validate) {
    throw new Error(`String ${str} does not end with suffix ${suffix}`);
  }

  return str;
}

/**
 * Normalizes a string by converting it to the NFC form and replacing non-breaking spaces with regular spaces.
 *
 * @param str - The string to normalize.
 * @returns The normalized string.
 */
export function normalize(str: string): string {
  return str.replace(/\u00A0/g, " ").normalize("NFC");
}

/**
 * Asynchronously replaces all occurrences of a search string or pattern with the results of an asynchronous replacer function.
 *
 * @template Args - The type of additional arguments passed to the replacer function.
 * @param str - The string in which to perform replacements.
 * @param searchValue - The string or regular expression to search for.
 * @param replacer - An asynchronous function that generates replacement strings.
 * @returns A promise that resolves to the string with all replacements made.
 */
export async function replaceAllAsync<Args extends unknown[]>(
  str: string,
  searchValue: string | RegExp,
  replacer: AsyncReplacer<Args>
): Promise<string> {
  const replacementPromises: Promise<string>[] = [];

  str.replaceAll(searchValue, (substring: string, ...args: unknown[]) => {
    replacementPromises.push(resolveValue(replacer, substring, ...args as [...Args]));
    return substring;
  });
  const replacements = await Promise.all(replacementPromises);
  return str.replaceAll(searchValue, (): string => replacements.shift()!);
}

/**
 * Converts a string into a valid JavaScript variable name by replacing invalid characters with underscores.
 *
 * @param str - The string to convert.
 * @returns The valid variable name.
 */
export function makeValidVariableName(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Ensures that a string starts with the specified prefix, adding it if necessary.
 *
 * @param str - The string to check.
 * @param prefix - The prefix to ensure.
 * @returns The string that starts with the prefix.
 */
export function ensureStartsWith(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str : prefix + str;
}

/**
 * Ensures that a string ends with the specified suffix, adding it if necessary.
 *
 * @param str - The string to check.
 * @param suffix - The suffix to ensure.
 * @returns The string that ends with the suffix.
 */
export function ensureEndsWith(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str : str + suffix;
}
