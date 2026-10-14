/**
 * @file
 *
 * Contains utility functions for validating, encoding and normalizing URLs.
 */

import { replaceAll } from './string.ts';

const SCHEME_REG_EXP = /^[A-Za-z][A-Za-z0-9+\-.]*:\S+$/;

const FILE_SCHEME_REG_EXP = /^file:/i;

const LEADING_SLASHES_REG_EXP = /^\/+/;

/**
 * Regular expression for the symbols that have to be percent-encoded in a URL.
 */
// eslint-disable-next-line no-control-regex, unicorn/prefer-unicode-code-point-escapes -- The regular expression is written to capture control characters, which are conventionally spelled as `\x` escapes; `\u{0}`-style escapes would obscure the `\x0E-\x1F` range without expressing anything the two-digit form cannot.
const SPECIAL_URL_SYMBOLS_REG_EXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

/**
 * Same as {@link SPECIAL_URL_SYMBOLS_REG_EXP}, but additionally matches a literal `%`.
 */
// eslint-disable-next-line no-control-regex, unicorn/prefer-unicode-code-point-escapes -- The regular expression is written to capture control characters, which are conventionally spelled as `\x` escapes; `\u{0}`-style escapes would obscure the `\x0E-\x1F` range without expressing anything the two-digit form cannot.
const SPECIAL_URL_SYMBOLS_WITH_PERCENT_REG_EXP = /[%\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

/**
 * Percent-encodes the symbols that break a URL: backslashes, spaces and the control characters. Every
 * other character — including non-ASCII ones and a literal `%` — is left as is, so the result stays
 * readable.
 *
 * A literal `%` is only encoded when `shouldEncodePercent` is set. Leaving it alone is the default
 * because it keeps the encoding idempotent for already-encoded input; the cost is that a path which
 * genuinely contains `%` (a folder actually named `a%20b`) decodes back to something else. Turn the flag
 * on whenever the input is a raw filesystem path that may contain `%`.
 *
 * @param url - The URL to encode.
 * @param shouldEncodePercent - Whether to encode a literal `%` as `%25`. Defaults to `false`.
 * @returns The encoded URL.
 *
 * @example
 * ```ts
 * encodeUrl(String.raw`path\to the\file.md`) // 'path%5Cto%20the%5Cfile.md'
 * encodeUrl('a%20b') // 'a%20b'
 * encodeUrl('a%20b', true) // 'a%2520b'
 * ```
 */
export function encodeUrl(url: string, shouldEncodePercent?: boolean): string {
  return replaceAll({
    $string: url,
    replacer: ({ substring: specialUrlSymbol }) => encodeURIComponent(specialUrlSymbol),
    searchValue: shouldEncodePercent ? SPECIAL_URL_SYMBOLS_WITH_PERCENT_REG_EXP : SPECIAL_URL_SYMBOLS_REG_EXP
  });
}

/**
 * Determines whether a given string is a `file://` URL.
 *
 * @param $string - The string to check.
 * @returns `true` if the string uses the `file:` scheme, otherwise `false`.
 */
export function isFileUrl($string: string): boolean {
  return FILE_SCHEME_REG_EXP.test($string);
}

/**
 * Determines whether a given string is a valid URL
 *
 * @param $string - The string to validate as a URL.
 * @returns `true` if the string is a valid URL, otherwise `false`.
 */
export function isUrl($string: string): boolean {
  if (/\s/.test($string)) {
    return false;
  }
  if ($string.includes('://')) {
    try {
      new URL($string);
      return true;
    } catch {
      return false;
    }
  }

  return SCHEME_REG_EXP.test($string);
}

/**
 * Normalizes a `file://` URL to a pretty form by converting backslashes to forward slashes. The URL is
 * expected to already be decoded. Non-`file://` URLs are returned unchanged.
 *
 * @param url - The URL to normalize.
 * @returns The normalized URL.
 */
export function normalizeFileUrl(url: string): string {
  return isFileUrl(url) ? url.replaceAll('\\', '/') : url;
}

/**
 * Converts a filesystem path into a `file:///` URL, percent-encoding it with {@link encodeUrl}.
 *
 * The backslashes are turned into forward slashes **after** the encoding, not before — a Windows path is
 * encoded to `%5C` first and only then rewritten to `/`, which is what makes `C:\a b\c` produce the
 * working `file:///C:/a%20b/c` rather than a link broken at the first space.
 *
 * The `file:///` prefix always ends up with exactly three slashes: any leading slashes the path already
 * has are dropped first, because `file:////home/x` parses as the path `//home/x`, not `/home/x`. A
 * Windows UNC path (`\\server\share`) is therefore rendered as `file:///server/share` rather than the
 * canonical host form `file://server/share`, which this function deliberately does not produce.
 *
 * @param path - The filesystem path to convert.
 * @param shouldEncodePercent - Whether to encode a literal `%` in the path as `%25`. Defaults to `false`.
 *   See {@link encodeUrl} for the trade-off.
 * @returns The `file:///` URL.
 *
 * @example
 * ```ts
 * pathToFileUrl(String.raw`C:\a b\c.txt`) // 'file:///C:/a%20b/c.txt'
 * pathToFileUrl('/home/user/a b.txt') // 'file:///home/user/a%20b.txt'
 * ```
 */
export function pathToFileUrl(path: string, shouldEncodePercent?: boolean): string {
  const encodedPath = encodeUrl(path, shouldEncodePercent).replaceAll('%5C', '/');
  return `file:///${encodedPath.replace(LEADING_SLASHES_REG_EXP, '')}`;
}
