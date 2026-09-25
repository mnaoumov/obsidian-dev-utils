/**
 * @file
 *
 * A commitlint rule that spellchecks a commit HEADER with the project's own `spellcheck` configuration.
 *
 * The header is the one part of a commit message that ships verbatim: a release turns every commit subject
 * since the last tag into a `- <subject>` bullet of the new `CHANGELOG.md` section, and spellchecks that
 * section before writing it. That check works, but it runs at release time, after the whole preflight gate,
 * and weeks after the subject was pushed to the default branch. At that point the only fixes are rewriting
 * published history or supplying the release notes by hand. The commit-msg hook is the last point at which
 * the word can still be changed for free.
 *
 * The header is checked AS the bullet it will become, attributed to `CHANGELOG.md`, so the verdict is the one
 * the release would give: the same `cspell` configuration, the same `words`, the same `ignorePaths`. And it
 * runs only where the project defines a `spellcheck` script, which is the condition the release applies too.
 * A project with no spelling configuration would otherwise have its commits judged against the stock
 * dictionaries alone, and refused over its own name.
 */

import type {
  AsyncRule,
  Plugin,
  RuleOutcome
} from '@commitlint/types';

import { ObsidianPluginRepoPaths } from '../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { spellcheckContent } from './linters/cspell-content.ts';
import { readPackageJson } from './npm.ts';
import { resolvePathFromRootSafe } from './root.ts';

/**
 * The name the rule is registered under.
 */
export const SPELLCHECK_HEADER_RULE_NAME = 'obsidian-dev-utils/spellcheck-header';

/**
 * The npm script whose presence opts a project into the check.
 */
const SPELLCHECK_SCRIPT_NAME = 'spellcheck';

type Commit = Parameters<AsyncRule>[0];

/**
 * Spellchecks the commit header as the changelog bullet it will become.
 *
 * Only the `always` condition is meaningful: `never` would require the header to be misspelled, so it is
 * treated the same way rather than inverted.
 *
 * @param commit - The parsed commit.
 * @returns A {@link Promise} that resolves to the rule outcome, naming each unknown word.
 */
export async function spellcheckHeaderRule(commit: Commit): Promise<RuleOutcome> {
  if (!commit.header) {
    return [true];
  }

  const packageJson = await readPackageJson();
  if (!Object.keys(packageJson.scripts ?? {}).includes(SPELLCHECK_SCRIPT_NAME)) {
    return [true];
  }

  const findings = await spellcheckContent({
    content: `- ${commit.header}\n`,
    filePath: resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ChangelogMd })
  });

  if (findings.length === 0) {
    return [true];
  }

  return [
    false,
    `the header does not pass \`${SPELLCHECK_SCRIPT_NAME}\`, and it ships verbatim into the next release's changelog:\n`
    + `${findings.join('\n')}\n`
    + 'Reword it, or, for a word this project really does use, add it to the project\'s `cspell` configuration.'
  ];
}

/**
 * The commitlint plugin carrying {@link spellcheckHeaderRule}.
 */
export const spellcheckHeaderPlugin: Plugin = {
  rules: {
    [SPELLCHECK_HEADER_RULE_NAME]: spellcheckHeaderRule
  }
};
