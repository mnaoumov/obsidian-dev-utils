/**
 * @packageDocumentation
 *
 * Shared commitlint configuration for Conventional Commits.
 */

import type { UserConfig } from '@commitlint/types';

/**
 * Commitlint configuration extending `@commitlint/config-conventional`.
 */
export const obsidianDevUtilsConfig: UserConfig = {
  extends: ['@commitlint/config-conventional']
};
