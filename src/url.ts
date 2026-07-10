/**
 * @file
 *
 * Contains a utility function for validating URLs.
 */

const SCHEME_REG_EXP = /^[A-Za-z][A-Za-z0-9+\-.]*:\S+$/;

const FILE_SCHEME_REG_EXP = /^file:/i;

/**
 * Determines whether a given string is a `file://` URL.
 *
 * @param str - The string to check.
 * @returns `true` if the string uses the `file:` scheme, otherwise `false`.
 */
export function isFileUrl(str: string): boolean {
  return FILE_SCHEME_REG_EXP.test(str);
}

/**
 * Determines whether a given string is a valid URL
 *
 * @param str - The string to validate as a URL.
 * @returns `true` if the string is a valid URL, otherwise `false`.
 */
export function isUrl(str: string): boolean {
  if (/\s/.test(str)) {
    return false;
  }
  if (str.includes('://')) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  return SCHEME_REG_EXP.test(str);
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
