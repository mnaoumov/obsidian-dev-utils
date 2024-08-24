/**
 * @packageDocumentation url
 * Contains a utility function for validating URLs.
 */

/**
 * Determines whether a given string is a valid URL, excluding file URLs.
 *
 * @param str - The string to validate as a URL.
 * @returns `true` if the string is a valid URL and not a file URL, otherwise `false`.
 */
export function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol !== "file:";
  } catch {
    return false;
  }
}
