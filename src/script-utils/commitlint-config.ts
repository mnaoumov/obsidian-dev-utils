/**
 * @file
 *
 * Shared commitlint configuration for Conventional Commits.
 */

/* v8 ignore start -- Declarative commitlint configuration; correctness is verified by running commitlint, not unit tests. */

import type { UserConfig } from '@commitlint/types';

/**
 * Commitlint configuration extending `@commitlint/config-conventional`.
 */
export const obsidianDevUtilsConfig: UserConfig = {
  extends: ['@commitlint/config-conventional']
};

/* v8 ignore stop */
