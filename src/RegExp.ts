/**
 * @file Contains utility functions for regular expressions.
 */

/**
 * Escapes special characters in a string to safely use it within a regular expression.
 *
 * @param str - The string to escape.
 * @returns The escaped string with special characters prefixed with a backslash.
 */
export function escapeRegExp(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
