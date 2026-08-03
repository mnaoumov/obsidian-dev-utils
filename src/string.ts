/**
 * @file
 *
 * Contains utility functions for string operations.
 */

import type { MaybeReturn } from './type.ts';
import type { ValueProvider } from './value-provider.ts';

import { abortSignalNever } from './abort-controller.ts';
import { escapeRegExp } from './reg-exp.ts';
import {
  assert,
  ensureNonNullable
} from './type-guards.ts';
import { resolveValue } from './value-provider.ts';

/**
 * An empty string constant.
 *
 * A shared sentinel for the `${EMPTY}` prefix that silences the `obsidianmd/ui/sentence-case` ESLint
 * false positive on legitimate lower-case UI text (e.g. `cursor` colliding with the `Cursor` brand).
 * `setName(`${EMPTY}...at cursor...`)` renders byte-identical `''` at runtime while the `{...}`
 * placeholder makes the rule skip the string. Consumers import this instead of redefining a per-file
 * `const EMPTY = ''`.
 */
export const EMPTY = '';

/**
 * A synchronous/asynchronous function that generates replacement strings, or a string to replace with.
 *
 * @typeParam CapturedGroupArguments - The types of the captured group arguments.
 */
export type AsyncReplacer<CapturedGroupArguments extends string[]> = ValueProvider<StringReplacement, ReplaceArguments<CapturedGroupArguments>>;

/**
 * Common arguments for the `replaceAll`/`replaceAllAsync` functions.
 *
 * @typeParam CapturedGroupArguments - The types of the captured group arguments.
 */
export interface ReplaceArguments<CapturedGroupArguments extends string[]> {
  /**
   * Captured group arguments.
   */
  capturedGroupArguments: CapturedGroupArguments;

  /**
   * Groups of the match.
   */
  groups: Record<string, string | undefined> | undefined;

  /**
   * Indices of the groups that were not found in the match.
   */
  missingGroupIndices: number[];

  /**
   * An offset of the match.
   */
  offset: number;

  /**
   * A source of the match.
   */
  source: string;

  /**
   * A substring of the match.
   */
  substring: string;
}

/**
 * A synchronous function that generates replacement strings, or a string to replace with.
 *
 * @typeParam CapturedGroupArguments - The types of the captured group arguments.
 */
export type Replacer<CapturedGroupArguments extends string[]> = (($arguments: ReplaceArguments<CapturedGroupArguments>) => StringReplacement) | StringReplacement;

type StringReplacement = MaybeReturn<string>;

/**
 * Mapping of special characters to their escaped counterparts.
 */
const ESCAPE_MAP: Record<string, string> = {
  '\n': String.raw`\n`,
  '\r': String.raw`\r`,
  '\t': String.raw`\t`,
  '\b': String.raw`\b`,
  '\f': String.raw`\f`,
  '\'': String.raw`\'`,
  '"': String.raw`\"`,
  '\\': '\\\\'
} as const;

const CR = '\r';
const LF = '\n';
const NOT_FOUND_INDEX = -1;

/**
 * Mapping of escaped special characters to their unescaped counterparts.
 */
const UNESCAPE_MAP: Record<string, string> = {};
for (const [key, value] of Object.entries(ESCAPE_MAP)) {
  UNESCAPE_MAP[value] = key;
}

/**
 * Parameters for {@link ensureEndsWith}.
 */
export interface EnsureEndsWithParams {
  /**
   * The string to check.
   */
  readonly $string: string;

  /**
   * The suffix to ensure.
   */
  readonly suffix: string;
}

/**
 * Parameters for {@link ensureStartsWith}.
 */
export interface EnsureStartsWithParams {
  /**
   * The string to check.
   */
  readonly $string: string;

  /**
   * The prefix to ensure.
   */
  readonly prefix: string;
}

/**
 * Parameters for {@link hasSingleOccurrence}.
 */
export interface HasSingleOccurrenceParams {
  /**
   * The string to check.
   */
  readonly $string: string;

  /**
   * The search value to check for.
   */
  readonly searchValue: string;
}

/**
 * Parameters for {@link indent}.
 */
export interface IndentParams {
  /**
   * The prefix to add to each line.
   */
  readonly prefix: string;

  /**
   * The string to indent.
   */
  readonly text: string;
}

/**
 * Parameters for {@link insertAt}.
 */
export interface InsertAtParams {
  /**
   * The string to insert the substring into.
   */
  readonly $string: string;

  /**
   * The index to end the substring at.
   */
  readonly endIndex?: number;

  /**
   * The index to insert the substring at.
   */
  readonly startIndex: number;

  /**
   * The substring to insert.
   */
  readonly substring: string;
}

/**
 * Parameters for {@link replaceAllAsync}.
 *
 * @typeParam ReplaceGroupArguments - The types of the captured group arguments.
 */
export interface ReplaceAllAsyncParams<ReplaceGroupArguments extends string[]> {
  /**
   * The string in which to perform replacements.
   */
  readonly $string: string;

  /**
   * The abort signal to control the execution of the function.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * A synchronous/asynchronous function that generates replacement strings, or a string to replace with.
   */
  readonly replacer: AsyncReplacer<ReplaceGroupArguments>;

  /**
   * The string or regular expression to search for.
   */
  readonly searchValue: RegExp | string;
}

/**
 * Parameters for {@link replaceAll}.
 *
 * @typeParam CapturedGroupArguments - The types of the captured group arguments.
 */
export interface ReplaceAllParams<CapturedGroupArguments extends string[]> {
  /**
   * The string in which to perform replacements.
   */
  readonly $string: string;

  /**
   * A replacer function that generates replacement strings, or a string to replace with.
   */
  readonly replacer: Replacer<CapturedGroupArguments>;

  /**
   * The string or regular expression to search for.
   */
  readonly searchValue: RegExp | string;
}

/**
 * Parameters for {@link trimEnd}.
 */
export interface TrimEndParams {
  /**
   * The string to trim.
   */
  readonly $string: string;

  /**
   * If `true`, throws an error if the string does not end with the suffix.
   *
   * @default `false`
   */
  readonly shouldValidate?: boolean;

  /**
   * The suffix to remove from the end of the string.
   */
  readonly suffix: string;
}

/**
 * Parameters for {@link trimStart}.
 */
export interface TrimStartParams {
  /**
   * The string to trim.
   */
  readonly $string: string;

  /**
   * The prefix to remove from the start of the string.
   */
  readonly prefix: string;

  /**
   * If `true`, throws an error if the string does not start with the prefix.
   *
   * @default `false`
   */
  readonly shouldValidate?: boolean;
}

/**
 * Parameters for {@link unindent}.
 */
export interface UnindentParams {
  /**
   * The prefix to remove from each line.
   */
  readonly prefix: string;

  /**
   * If `true`, throws an error if a line is not indented with the prefix.
   *
   * @default `false`
   */
  readonly shouldThrowIfNotIndented?: boolean;

  /**
   * The string to unindent.
   */
  readonly text: string;
}

/**
 * Ensures that a string ends with the specified suffix, adding it if necessary.
 *
 * @param params - The parameters.
 * @returns The string that ends with the suffix.
 */
export function ensureEndsWith(params: EnsureEndsWithParams): string {
  const { $string, suffix } = params;
  return $string.endsWith(suffix) ? $string : $string + suffix;
}

/**
 * Ensures that a string has `LF` line endings.
 *
 * It replaces `CRLF` line endings with `LF`.
 *
 * @param $string - The string.
 * @returns The string with `LF` line endings.
 */
export function ensureLfEndings($string: string): string {
  return $string.replaceAll(/\r\n?/g, '\n');
}

/**
 * Ensures that a string starts with the specified prefix, adding it if necessary.
 *
 * @param params - The parameters.
 * @returns The string that starts with the prefix.
 */
export function ensureStartsWith(params: EnsureStartsWithParams): string {
  const { $string, prefix } = params;
  return $string.startsWith(prefix) ? $string : prefix + $string;
}

/**
 * Escapes special characters in a string.
 *
 * @param $string - The string to escape.
 * @returns The escaped string.
 */
export function escape($string: string): string {
  return replace($string, ESCAPE_MAP);
}

/**
 * Returns a function that maps LF-normalized offsets to original offsets.
 *
 * @param $string - The string to get the LF-normalized indices from.
 * @returns A function that maps LF-normalized offsets to original offsets.
 */
export function getLfNormalizedOffsetToOriginalOffsetMapper($string: string): (lfOffset: number) => number {
  const lfOffsetToOriginalOffsetMap: number[] = [];

  for (let index = 0; index < $string.length; index++) {
    if ($string[index] === CR && $string[index + 1] === LF) {
      lfOffsetToOriginalOffsetMap.push(index + 1);
      index++;
    } else {
      lfOffsetToOriginalOffsetMap.push(index);
    }
  }

  return (lfOffset: number): number => {
    if (lfOffset < 0) {
      return lfOffset;
    }
    if (lfOffset >= lfOffsetToOriginalOffsetMap.length) {
      return lfOffset - lfOffsetToOriginalOffsetMap.length + $string.length;
    }

    assert(lfOffsetToOriginalOffsetMap[lfOffset] !== undefined, 'Could not map offset');
    return lfOffsetToOriginalOffsetMap[lfOffset];
  };
}

/**
 * Checks if a string has a single occurrence of a search value.
 *
 * @param params - The parameters.
 * @returns `true` if the string has a single occurrence of the search value, `false` otherwise.
 */
export function hasSingleOccurrence(params: HasSingleOccurrenceParams): boolean {
  const { $string, searchValue } = params;
  const firstIndex = $string.indexOf(searchValue);
  const lastIndex = $string.lastIndexOf(searchValue);
  return firstIndex !== NOT_FOUND_INDEX && firstIndex === lastIndex;
}

/**
 * Indents a string by adding a prefix to each line.
 *
 * @param params - The parameters.
 * @returns The indented string.
 */
export function indent(params: IndentParams): string {
  const { prefix, text } = params;
  return text.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

/**
 * Inserts a substring at a specified position in a string.
 *
 * @param params - The parameters.
 * @returns The modified string with the substring inserted.
 */
export function insertAt(params: InsertAtParams): string {
  const {
    $string,
    endIndex,
    startIndex,
    substring
  } = params;
  const effectiveEndIndex = endIndex ?? startIndex;
  return $string.slice(0, startIndex) + substring + $string.slice(effectiveEndIndex);
}

/**
 * Converts a string into a valid JavaScript variable name by replacing invalid characters with underscores.
 *
 * @param $string - The string to convert.
 * @returns The valid variable name.
 */
export function makeValidVariableName($string: string): string {
  return replaceAll({
    $string,
    replacer: '_',
    searchValue: /[^a-zA-Z0-9_]/g
  });
}

/**
 * Normalizes a string by converting it to the NFC form and replacing non-breaking spaces with regular spaces.
 *
 * @param $string - The string to normalize.
 * @returns The normalized string.
 */
export function normalizeString($string: string): string {
  return replaceAll({
    $string,
    replacer: ' ',
    searchValue: /\u00A0|\u202F/g
  }).normalize('NFC');
}

/**
 * Replaces occurrences of strings in a given string based on a replacements map.
 *
 * @param $string - The string to perform replacements on.
 * @param replacementsMap - An object mapping strings to their replacement values.
 * @returns The modified string with replacements applied.
 */
export function replace($string: string, replacementsMap: Record<string, string>): string {
  const regExp = new RegExp(Object.keys(replacementsMap).map((source) => escapeRegExp(source)).join('|'), 'g');
  return replaceAll({
    $string,
    replacer: ({ substring: source }) => ensureNonNullable(replacementsMap[source]),
    searchValue: regExp
  });
}

/**
 * Replaces all occurrences of a search string or pattern with the results of an replacer function.
 *
 * @typeParam CapturedGroupArguments - The types of the captured group arguments.
 * @param params - The parameters.
 * @returns The string with all replacements made.
 */
export function replaceAll<CapturedGroupArguments extends string[]>(params: ReplaceAllParams<CapturedGroupArguments>): string {
  const { $string, replacer } = params;
  let { searchValue } = params;
  if (replacer === undefined) {
    return $string;
  }

  if (searchValue instanceof RegExp && !searchValue.global) {
    searchValue = new RegExp(searchValue.source, `${searchValue.flags}g`);
  }

  if (typeof replacer === 'string') {
    return $string.replaceAll(searchValue, replacer);
  }

  return $string.replaceAll(searchValue, (substring: string, ...$arguments: unknown[]) => {
    const SOURCE_INDEX_OFFSET_FOR_GROUP_ARG = 2;
    const hasGroupsArgument = typeof $arguments.at(-1) === 'object';
    const sourceIndex = hasGroupsArgument ? $arguments.length - SOURCE_INDEX_OFFSET_FOR_GROUP_ARG : $arguments.length - 1;

    const replaceArguments: ReplaceArguments<CapturedGroupArguments> = {
      // eslint-disable-next-line no-restricted-syntax -- Can't avoid.
      capturedGroupArguments: [] as unknown[] as CapturedGroupArguments,
      groups: hasGroupsArgument ? $arguments.at(-1) as Record<string, string | undefined> : undefined,
      missingGroupIndices: [],
      offset: $arguments.at(sourceIndex - 1) as number,
      source: $arguments.at(sourceIndex) as string,
      substring
    };

    for (let index = 0; index < sourceIndex - 1; index++) {
      const item = $arguments[index];
      if (typeof item === 'string') {
        replaceArguments.capturedGroupArguments.push(item);
        /* v8 ignore start -- v8 tracks the implicit else branch that never happens. */
      } else if (item === undefined) {
        /* v8 ignore stop */
        replaceArguments.missingGroupIndices.push(index);
      }
    }

    return (replacer(replaceArguments) as string | undefined) ?? replaceArguments.substring;
  });
}

/**
 * Asynchronously replaces all occurrences of a search string or pattern with the results of an asynchronous replacer function.
 *
 * @typeParam ReplaceGroupArguments - The types of the captured group arguments.
 * @param params - The parameters.
 * @returns A {@link Promise} that resolves to the string with all replacements made.
 */
export async function replaceAllAsync<ReplaceGroupArguments extends string[]>(params: ReplaceAllAsyncParams<ReplaceGroupArguments>): Promise<string> {
  const { $string, replacer, searchValue } = params;
  let { abortSignal } = params;
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();
  if (typeof replacer === 'string') {
    return replaceAll({
      $string,
      replacer,
      searchValue
    });
  }

  const replacementAsyncFns: (() => Promise<StringReplacement>)[] = [];

  replaceAll<ReplaceGroupArguments>({
    $string,
    replacer: ($arguments) => {
      replacementAsyncFns.push(() => resolveValue(replacer, { abortSignal, ...$arguments }));
      return '';
    },
    searchValue
  });

  const replacements: StringReplacement[] = [];

  for (const asyncFunction of replacementAsyncFns) {
    abortSignal.throwIfAborted();
    replacements.push(await asyncFunction());
  }

  abortSignal.throwIfAborted();
  return replaceAll({
    $string,
    replacer: ($arguments): string => replacements.shift() ?? $arguments.substring,
    searchValue
  });
}

/**
 * Trims the specified suffix from the end of a string.
 *
 * @param params - The parameters.
 * @returns The trimmed string.
 * @throws If `shouldValidate` is `true` and the string does not end with the suffix.
 */
export function trimEnd(params: TrimEndParams): string {
  const { $string, shouldValidate, suffix } = params;
  if ($string.endsWith(suffix)) {
    return $string.slice(0, -suffix.length);
  }

  if (shouldValidate) {
    throw new Error(`String ${$string} does not end with suffix ${suffix}`);
  }

  return $string;
}

/**
 * Trims the specified prefix from the start of a string.
 *
 * @param params - The parameters.
 * @returns The trimmed string.
 * @throws If `shouldValidate` is `true` and the string does not start with the prefix.
 */
export function trimStart(params: TrimStartParams): string {
  const { $string, prefix, shouldValidate } = params;
  if ($string.startsWith(prefix)) {
    return $string.slice(prefix.length);
  }

  if (shouldValidate) {
    throw new Error(`String ${$string} does not start with prefix ${prefix}`);
  }

  return $string;
}

/**
 * Unescapes a string by replacing escape sequences with their corresponding characters.
 *
 * @param $string - The string to unescape.
 * @returns The unescaped string.
 */
export function unescape($string: string): string {
  return replace($string, UNESCAPE_MAP);
}

/**
 * Unindents a string by removing a prefix from each line.
 *
 * @param params - The parameters.
 * @returns The unindented string.
 */
export function unindent(params: UnindentParams): string {
  const { prefix, shouldThrowIfNotIndented = false, text } = params;
  return text.split('\n').map((line) => {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length);
    }
    if (shouldThrowIfNotIndented) {
      throw new Error(`Line "${line}" is not indented with "${prefix}"`);
    }
    return line;
  }).join('\n');
}
