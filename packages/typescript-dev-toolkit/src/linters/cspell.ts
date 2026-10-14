/**
 * @file
 *
 * This module provides a function for running a spellcheck on the codebase using the `cspell` library.
 * It reports any spelling issues found in the code and returns a {@link CliTaskResult} indicating whether the spellcheck was successful.
 */

import { resolveToolCommand } from '../package-manager.ts';
import {
  execFromRoot,
  getRootFolder
} from '../root.ts';

/**
 * Parameters for the {@link spellcheck} function.
 */
export interface SpellcheckOptions {
  /**
   * Optional file paths to check. If omitted, checks the entire project.
   */
  readonly paths?: string[] | undefined;
}

/**
 * Runs a spellcheck on the entire codebase using `cspell`.
 *
 * Checks all files in the current folder and its subfolders for spelling issues.
 * If issues are found, they are logged to the console with their file path, line, and column number.
 *
 * Uses `--no-must-find-files` so that cspell does not fail when all provided paths
 * are excluded by built-in ignore rules (e.g., `package-lock.json`).
 *
 * Uses `--gitignore` so a path git ignores is a path cspell skips — generated output, build folders and
 * every `node_modules` are covered without a hand-maintained `ignorePaths` list that drifts from
 * `.gitignore`. It is passed on the command line rather than set in `cspell.json` so that every project
 * consuming this function inherits it, rather than each having to edit its own config. `--gitignore-root`
 * stops the search at the project root, so a `.gitignore` in some parent folder outside the project cannot
 * silently remove files from the check.
 *
 * @param options - The {@link SpellcheckOptions}.
 * @returns A {@link Promise} that resolves to a {@link CliTaskResult}, indicating the success or failure of the spellcheck.
 */
export async function spellcheck(options?: SpellcheckOptions): Promise<void> {
  const { paths } = options ?? {};
  /* v8 ignore start -- The paths-provided branch is only exercised by consumer projects passing file lists. */
  const targets = paths?.length ? paths : ['.'];
  /* v8 ignore stop */
  const rootFolder = getRootFolder();
  await execFromRoot([
    ...resolveToolCommand({ tool: 'cspell' }),
    '--no-progress',
    '--no-must-find-files',
    '--gitignore',
    ...rootFolder === null ? [] : ['--gitignore-root', rootFolder],
    { batchedArguments: targets }
  ]);
}
