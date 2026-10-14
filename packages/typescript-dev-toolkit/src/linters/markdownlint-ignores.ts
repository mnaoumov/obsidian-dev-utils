/**
 * @file
 *
 * The markdown paths `lint:md` skips ON TOP of the ones `.gitignore` already excludes.
 *
 * Deriving the ignore set from `.gitignore` is right and stays — git's own semantics, nested ignore files
 * and all, with no hand-maintained list to drift. But it can only ever skip what git skips, and a
 * repository can **deliberately track** a vendored `node_modules` tree. `obsidian-codescript-toolkit`
 * does: `demo-vault/.gitignore` re-includes `_assets/CodeScriptToolkit/node_modules/` on purpose, so the
 * demo vault's "NPM modules" note can `require('uuid')` offline. `lint:md` then linted a third-party
 * README and failed the whole gate on its table style, its inline HTML, and a relative link to a file
 * that only exists in the upstream repository — none of which is this project's to fix.
 *
 * So the shared helper is "`.gitignore` **plus** these", which is what the `.gitignore`-derived work
 * anticipated. This is NOT a return to the hand-maintained globs that preceded it: those were removed
 * because they DUPLICATED `.gitignore`, not because an explicit entry is ever wrong.
 *
 * Both halves of `lint:md` read from here so they cannot disagree — markdownlint-cli2 takes an ignore
 * configuration, while `linkinator` takes a file list and has to be filtered before it is invoked.
 */

/**
 * The glob form, for markdownlint-cli2's `ignores`.
 */
export const NODE_MODULES_IGNORE_GLOB = '**/node_modules/**';

/**
 * The directory name the glob above matches.
 */
const NODE_MODULES_FOLDER_NAME = 'node_modules';

/**
 * Checks whether a path sits inside a `node_modules` folder at any depth.
 *
 * Matches on a full path SEGMENT rather than a substring, so a file whose own name merely contains the
 * word (`node_modules-migration.md`) is not swept up with it.
 *
 * @param path - A path relative to the repository root, separated by `/` (the form `git ls-files` emits).
 * @returns `true` when the path is inside a `node_modules` folder.
 */
export function checkIsInNodeModules(path: string): boolean {
  return path.split('/').includes(NODE_MODULES_FOLDER_NAME);
}
