/**
 * @packageDocumentation
 *
 * Contains utility functions for string operations.
 */

import type { MaybeReturn } from './Type.ts';
import type { ValueProvider } from './ValueProvider.ts';

import { abortSignalNever } from './AbortController.ts';
import { throwExpression } from './Error.ts';
import { escapeRegExp } from './RegExp.ts';
import { resolveValue } from './ValueProvider.ts';

/**
 * A synchronous/asynchronous function that generates replacement strings, or a string to replace with.
 */
export type AsyncReplacer<ReplaceGroupArgs extends string[]> = ValueProvider<StringReplacement, [ReplaceCommonArgs, ...ReplaceGroupArgs]>;

/**
 * Common arguments for the `replaceAll`/`replaceAllAsync` functions.
 */
export interface ReplaceCommonArgs {
  /**
   * The groups of the match.
   */
  groups: Record<string, string | undefined> | undefined;

  /**
   * The indices of the groups that were not found in the match.
   */
  missingGroupIndices: number[];

  /**
   * The offset of the match.
   */
  offset: number;

  /**
   * The source of the match.
   */
  source: string;

  /**
   * The substring of the match.
   */
  substring: string;
}

/**
 * A synchronous function that generates replacement strings, or a string to replace with.
 */
export type Replacer<ReplaceGroupArgs extends string[]> = ((...args: [ReplaceCommonArgs, ...ReplaceGroupArgs]) => StringReplacement) | StringReplacement;

type StringReplacement = MaybeReturn<string>;

/**
 * Mapping of special characters to their escaped counterparts.
 */
const ESCAPE_MAP: Record<string, string> = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
  '\'': '\\\'',
  '"': '\\"',
  '\\': '\\\\'
} as const;

/**
 * Mapping of escaped special characters to their unescaped counterparts.
 */
const UNESCAPE_MAP: Record<string, string> = {};
for (const [key, value] of Object.entries(ESCAPE_MAP)) {
  UNESCAPE_MAP[value] = key;
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
 * Escapes special characters in a string.
 *
 * @param str - The string to escape.
 * @returns The escaped string.
 */
export function escape(str: string): string {
  return replace(str, ESCAPE_MAP);
}

/**
 * Inserts a substring at a specified position in a string.
 *
 * @param str - The string to insert the substring into.
 * @param substring - The substring to insert.
 * @param startIndex - The index to insert the substring at.
 * @param endIndex - The index to end the substring at.
 * @returns The modified string with the substring inserted.
 */
export function insertAt(str: string, substring: string, startIndex: number, endIndex?: number): string {
  endIndex ??= startIndex;
  return str.slice(0, startIndex) + substring + str.slice(endIndex);
}

/**
 * Converts a string into a valid JavaScript variable name by replacing invalid characters with underscores.
 *
 * @param str - The string to convert.
 * @returns The valid variable name.
 */
export function makeValidVariableName(str: string): string {
  return replaceAll(str, /[^a-zA-Z0-9_]/g, '_');
}

/**
 * Normalizes a string by converting it to the NFC form and replacing non-breaking spaces with regular spaces.
 *
 * @param str - The string to normalize.
 * @returns The normalized string.
 */
export function normalize(str: string): string {
  return replaceAll(str, /\u00A0|\u202F/g, ' ').normalize('NFC');
}

/**
 * Replaces occurrences of strings in a given string based on a replacements map.
 *
 * @param str - The string to perform replacements on.
 * @param replacementsMap - An object mapping strings to their replacement values.
 * @returns The modified string with replacements applied.
 */
export function replace(str: string, replacementsMap: Record<string, string>): string {
  const regExp = new RegExp(Object.keys(replacementsMap).map((source) => escapeRegExp(source)).join('|'), 'g');
  return replaceAll(str, regExp, ({ substring: source }) => replacementsMap[source] ?? throwExpression(new Error(`Unexpected replacement source: ${source}`)));
}

/**
 * Replaces all occurrences of a search string or pattern with the results of an replacer function.
 *
 * @typeParam ReplaceGroupArgs - The type of additional arguments passed to the replacer function.
 * @param str - The string in which to perform replacements.
 * @param searchValue - The string or regular expression to search for.
 * @param replacer - A replacer function that generates replacement strings, or a string to replace with.
 * @returns The string with all replacements made.
 */
export function replaceAll<ReplaceGroupArgs extends string[]>(
  str: string,
  searchValue: RegExp | string,
  replacer: Replacer<ReplaceGroupArgs>
): string {
  if (typeof replacer === 'undefined') {
    return str;
  }

  if (searchValue instanceof RegExp && !searchValue.global) {
    searchValue = new RegExp(searchValue.source, `${searchValue.flags}g`);
  }

  if (typeof replacer === 'string') {
    return str.replaceAll(searchValue, replacer);
  }

  return str.replaceAll(searchValue, (substring: string, ...args: unknown[]) => {
    const SOURCE_INDEX_OFFSET_FOR_GROUP_ARG = 2;
    const hasGroupsArg = typeof args.at(-1) === 'object';
    const sourceIndex = hasGroupsArg ? args.length - SOURCE_INDEX_OFFSET_FOR_GROUP_ARG : args.length - 1;

    const commonArgs: ReplaceCommonArgs = {
      groups: hasGroupsArg ? args.at(-1) as Record<string, string | undefined> : undefined,
      missingGroupIndices: [],
      offset: args.at(sourceIndex - 1) as number,
      source: args.at(sourceIndex) as string,
      substring
    };

    const groupArgs = args.slice(0, sourceIndex - 1).map((arg, index) => {
      if (typeof arg === 'string') {
        return arg;
      }

      if (typeof arg === 'undefined') {
        commonArgs.missingGroupIndices.push(index);
        return '';
      }

      throw new Error(`Unexpected argument type: ${typeof arg}`);
    }) as ReplaceGroupArgs;

    return (replacer(commonArgs, ...groupArgs) as string | undefined) ?? commonArgs.substring;
  });
}

/**
 * Asynchronously replaces all occurrences of a search string or pattern with the results of an asynchronous replacer function.
 *
 * @typeParam ReplaceGroupArgs - The type of additional arguments passed to the replacer function.
 * @param str - The string in which to perform replacements.
 * @param searchValue - The string or regular expression to search for.
 * @param replacer - A synchronous/asynchronous function that generates replacement strings, or a string to replace with.
 * @param abortSignal - The abort signal to control the execution of the function.
 * @returns A {@link Promise} that resolves to the string with all replacements made.
 */
export async function replaceAllAsync<ReplaceGroupArgs extends string[]>(
  str: string,
  searchValue: RegExp | string,
  replacer: AsyncReplacer<ReplaceGroupArgs>,
  abortSignal?: AbortSignal
): Promise<string> {
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();
  if (typeof replacer === 'string') {
    return replaceAll(str, searchValue, replacer);
  }

  const replacementAsyncFns: (() => Promise<StringReplacement>)[] = [];

  replaceAll<ReplaceGroupArgs>(str, searchValue, (commonArgs, ...groupArgs) => {
    replacementAsyncFns.push(() => resolveValue(replacer, abortSignal, commonArgs, ...groupArgs));
    return '';
  });

  const replacements: StringReplacement[] = [];

  for (const asyncFn of replacementAsyncFns) {
    abortSignal.throwIfAborted();
    replacements.push(await asyncFn());
  }

  abortSignal.throwIfAborted();
  return replaceAll(str, searchValue, (args): string => replacements.shift() ?? args.substring);
}

/**
 * Trims the specified suffix from the end of a string.
 *
 * @param str - The string to trim.
 * @param suffix - The suffix to remove from the end of the string.
 * @param shouldValidate - If true, throws an error if the string does not end with the suffix.
 * @returns The trimmed string.
 * @throws If `validate` is true and the string does not end with the suffix.
 */
export function trimEnd(str: string, suffix: string, shouldValidate?: boolean): string {
  if (str.endsWith(suffix)) {
    return str.slice(0, -suffix.length);
  }

  if (shouldValidate) {
    throw new Error(`String ${str} does not end with suffix ${suffix}`);
  }

  return str;
}

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
 * Unescapes a string by replacing escape sequences with their corresponding characters.
 *
 * @param str - The string to unescape.
 * @returns The unescaped string.
 */
export function unescape(str: string): string {
  return replace(str, UNESCAPE_MAP);
}
