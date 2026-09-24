/**
 * @file
 *
 * A commitlint rule that refuses a commit message matching a pattern from the UNPUBLISHED forbidden-patterns
 * list — in its header, its body or its footer.
 *
 * The release already refuses a changelog section carrying such a pattern, but a changelog section holds commit
 * SUBJECTS only, so a body line was never scanned by anything: it reached the public history the moment the
 * commit was pushed, and a pushed commit with descendants cannot be cleaned without rewriting published history.
 * The commit-msg hook is the one point where a body is checked before it exists anywhere else.
 *
 * The list comes from the same place as the release's: the file named by the `FORBIDDEN_PATTERNS_FILE`
 * environment variable (see `forbidden-patterns.ts`). The rule passes when nothing is configured, so a consumer
 * who has not set it sees no change at all.
 */

import type {
  AsyncRule,
  Plugin,
  RuleOutcome
} from '@commitlint/types';

import {
  findForbiddenPatternMatches,
  FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE,
  readForbiddenPatterns
} from './forbidden-patterns.ts';

/**
 * The name the rule is registered under.
 */
export const NO_FORBIDDEN_PATTERNS_RULE_NAME = 'obsidian-dev-utils/no-forbidden-patterns';

type Commit = Parameters<AsyncRule>[0];

/**
 * Checks the whole commit message — header, body and footer — against the forbidden patterns.
 *
 * Only the `always` condition is meaningful: `never` would require every line to carry a forbidden pattern, so
 * it is treated the same way rather than inverted.
 *
 * @param commit - The parsed commit.
 * @returns A {@link Promise} that resolves to the rule outcome, naming each offending line and what matched.
 */
export async function noForbiddenPatternsRule(commit: Commit): Promise<RuleOutcome> {
  const patterns = await readForbiddenPatterns();
  const text = [commit.header, commit.body, commit.footer].filter((part) => part !== null).join('\n');
  const matches = findForbiddenPatternMatches(text, patterns);

  if (matches.length === 0) {
    return [true];
  }

  const offendingLines = matches.map(({ line, match }) => `${line}    <- ${match}`).join('\n');
  return [false, `the commit message matches a pattern from the file ${FORBIDDEN_PATTERNS_FILE_ENV_VARIABLE} names:\n${offendingLines}`];
}

/**
 * The commitlint plugin carrying {@link noForbiddenPatternsRule}.
 */
export const forbiddenPatternsPlugin: Plugin = {
  rules: {
    [NO_FORBIDDEN_PATTERNS_RULE_NAME]: noForbiddenPatternsRule
  }
};
