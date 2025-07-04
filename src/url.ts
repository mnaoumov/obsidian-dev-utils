/**
 * @packageDocumentation
 *
 * Contains a utility function for validating URLs.
 */

const SCHEME_REG_EXP = /^[A-Za-z][A-Za-z0-9+\-.]*:\S+$/;

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
