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

const ERROR_SEVERITY = 2;

/**
 * Commitlint configuration extending `@commitlint/config-conventional`, plus a rule refusing a message whose
 * header, body or footer matches the unpublished forbidden-patterns list (a no-op when none is configured).
 */
export const obsidianDevUtilsConfig: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  plugins: [forbiddenPatternsPlugin],
  rules: {
    [NO_FORBIDDEN_PATTERNS_RULE_NAME]: [ERROR_SEVERITY, 'always']
  }
};

/* v8 ignore stop */
