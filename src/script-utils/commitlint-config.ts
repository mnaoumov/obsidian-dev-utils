/**
 * @file
 *
 * Shared commitlint configuration for Conventional Commits.
 */

/* v8 ignore start -- Declarative commitlint configuration; correctness is verified by running commitlint, not unit tests. */

import type { UserConfig } from '@commitlint/types';

import {
  forbiddenPatternsPlugin,
  NO_FORBIDDEN_PATTERNS_RULE_NAME
} from './commitlint-forbidden-patterns.ts';
import {
  SPELLCHECK_HEADER_RULE_NAME,
  spellcheckHeaderPlugin
} from './commitlint-spellcheck-header.ts';

const ERROR_SEVERITY = 2;

/**
 * Commitlint configuration extending `@commitlint/config-conventional`, plus a rule refusing a message whose
 * header, body or footer matches the unpublished forbidden-patterns list (a no-op when none is configured), and
 * a rule spellchecking the header the way the release spellchecks the changelog bullet it becomes (a no-op in a
 * project with no `spellcheck` script).
 */
export const obsidianDevUtilsConfig: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  // ONE plugin object, never two: `@commitlint/load` stores every inline plugin under the same `local` key, so a
  // second object silently replaces the first and its rule then fails as "Found rules without implementation".
  plugins: [
    {
      rules: {
        ...forbiddenPatternsPlugin.rules,
        ...spellcheckHeaderPlugin.rules
      }
    }
  ],
  rules: {
    [NO_FORBIDDEN_PATTERNS_RULE_NAME]: [ERROR_SEVERITY, 'always'],
    [SPELLCHECK_HEADER_RULE_NAME]: [ERROR_SEVERITY, 'always']
  }
};

/* v8 ignore stop */
