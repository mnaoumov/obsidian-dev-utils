/**
 * @file
 *
 * Lints an Obsidian plugin with ESLint: the generic runner from `@mnaoumov/typescript-dev-toolkit`, which copies
 * this package's `eslint.config.mts` template into a project that has no configuration yet.
 */

import type { LintOptions } from '@mnaoumov/typescript-dev-toolkit/linters/eslint';

import { lint as lintGeneric } from '@mnaoumov/typescript-dev-toolkit/linters/eslint';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';

import { getTemplateFilePath } from '../templates.ts';

/**
 * Lints the project with ESLint.
 *
 * @param options - The {@link LintOptions}.
 */
export async function lint(options?: LintOptions): Promise<void> {
  await lintGeneric({ defaultConfigFilePath: getTemplateFilePath(RepoPaths.EslintConfigMts), ...options });
}
export { type LintOptions } from '@mnaoumov/typescript-dev-toolkit/linters/eslint';
