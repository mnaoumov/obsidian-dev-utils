/**
 * @file
 *
 * The paths every linter in this package skips, whichever file type it lints.
 *
 * Both `lint` and `lint:md` derive their ignore set from git — ESLint through `includeIgnoreFile`,
 * markdownlint-cli2 through `gitignore: true` — and that is right and stays. But both read only
 * `.gitignore` files, while Claude Code excludes its worktree folder through `.git/info/exclude`
 * instead. So `git status` reads clean while a second, complete checkout of the repository sits under
 * the root the linters walk, and each one lints the copy:
 *
 * - ESLint ran out of memory rather than reporting anything — `FATAL ERROR: Ineffective mark-compacts
 *   near heap limit` after 97 s at the default 4 GB heap, with a single worktree present. That reads as
 *   a broken toolchain, not as a stray directory, which is what makes this worth an explicit entry.
 * - markdownlint-cli2 reported the copy's markdown, including prose a project deliberately exempts at
 *   its real path and third-party markdown that is not ours to fix.
 *
 * The `linkinator` half of `lint:md`, `cspell` and `dprint` are all unaffected and need nothing:
 * `linkinator` is handed a `git ls-files` list, and the other two honour `.git/info/exclude` as git
 * itself does. Measured, not assumed.
 *
 * This module is the non-markdown counterpart of `markdownlint-ignores.ts` — that one holds the
 * exclusions that are about markdown, this one the exclusions that are about no file type at all.
 */

import { ObsidianPluginRepoPaths } from '../../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { join } from '../../path.ts';

/**
 * The glob matching everything inside {@link ObsidianPluginRepoPaths.ClaudeWorktrees}, for any linter
 * that takes an ignore configuration.
 */
export const CLAUDE_WORKTREES_IGNORE_GLOB = join(ObsidianPluginRepoPaths.ClaudeWorktrees, ObsidianPluginRepoPaths.AnyPath);
