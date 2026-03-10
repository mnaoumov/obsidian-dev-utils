/**
 * @packageDocumentation
 *
 * This module provides a function for running a spellcheck on the codebase using the `cspell` library.
 * It reports any spelling issues found in the code and returns a {@link CliTaskResult} indicating whether the spellcheck was successful.
 */

import { execFromRoot } from '../root.ts';

/**
 * Parameters for the {@link spellcheck} function.
 */
export interface SpellcheckParams {
  /**
   * Optional file paths to check. If omitted, checks the entire project.
   */
  paths?: string[] | undefined;
}

/**
 * Runs a spellcheck on the entire codebase using `cspell`.
 *
 * Checks all files in the current folder and its subfolders for spelling issues.
 * If issues are found, they are logged to the console with their file path, line, and column number.
 *
 * @param params - The {@link SpellcheckParams}.
 * @returns A {@link Promise} that resolves to a {@link CliTaskResult}, indicating the success or failure of the spellcheck.
 */
export async function spellcheck(params?: SpellcheckParams): Promise<void> {
  const { paths } = params ?? {};
  const targets = paths?.length ? paths : ['.'];
  await execFromRoot(['npx', 'cspell', ...targets, '--no-progress']);
}
