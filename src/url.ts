/**
 * @packageDocumentation
 *
 * Contains a utility function for validating URLs.
 */

/**
 * Determines whether a given string is a valid URL
 *
 * @param str - The string to validate as a URL.
 * @returns `true` if the string is a valid URL, otherwise `false`.
 */
export function isUrl(str: string): boolean {
  try {
    if (!str.includes('://')) {
      return false;
    }
    if (str.trim() !== str) {
      return false;
    }
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
