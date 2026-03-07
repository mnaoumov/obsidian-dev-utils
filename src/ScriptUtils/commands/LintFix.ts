/**
 * @packageDocumentation
 *
 * Lint the source code and apply automatic fixes.
 */

import { lint } from '../ESLint/ESLint.ts';

/**
 * Lints the source code and applies automatic fixes.
 *
 * @returns A {@link Promise} that resolves when linting and fixing is complete.
 */
export async function lintFix(): Promise<void> {
  await lint(true);
}
