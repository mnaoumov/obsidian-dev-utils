/**
 * @packageDocumentation
 *
 * Lint the markdown documentation and apply automatic fixes.
 */

import { lintMarkdown } from '../markdownlint/markdownlint.ts';

/**
 * Lints the markdown documentation and applies automatic fixes.
 *
 * @returns A {@link Promise} that resolves when linting and fixing is complete.
 */
export async function lintMarkdownFix(): Promise<void> {
  await lintMarkdown(true);
}
