/**
 * @packageDocumentation spellcheck
 * This module provides a function for running a spellcheck on the codebase using the `cspell` library.
 * It reports any spelling issues found in the code and returns a `TaskResult` indicating whether the spellcheck was successful.
 */

import { execFromRoot } from './Root.ts';

/**
 * Runs a spellcheck on the entire codebase using `cspell`.
 *
 * The function checks all files in the current directory and its subdirectories for spelling issues.
 * If issues are found, they are logged to the console with their file path, line, and column number.
 *
 * @returns A `Promise` that resolves to a `TaskResult`, indicating the success or failure of the spellcheck.
 */
export async function spellcheck(): Promise<void> {
  await execFromRoot('npx cspell . --no-progress');
}
