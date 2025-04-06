/**
 * @packageDocumentation
 *
 * Contains utility functions for regular expressions.
 */

/**
 * Escapes special characters in a string to safely use it within a regular expression.
 *
 * @param str - The string to escape.
 * @returns The escaped string with special characters prefixed with a backslash.
 */
export function escapeRegExp(str: string): string {
  // NOTE: We can't use `replaceAll()` from `String.ts` here because it introduces a circular dependency.
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a string is a valid regular expression.
 *
 * @param str - The string to check.
 * @returns `true` if the string is a valid regular expression, `false` otherwise.
 */
export function isValidRegExp(str: string): boolean {
  try {
    new RegExp(str);
    return true;
  } catch {
    return false;
  }
}
