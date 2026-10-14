/**
 * @file
 *
 * Lints an Obsidian plugin's markdown: the generic runner from `@mnaoumov/typescript-dev-toolkit`, which copies
 * this package's `.markdownlint-cli2.mjs` template into a project that has no configuration yet.
 */

import type { LintOptions } from '@mnaoumov/typescript-dev-toolkit/linters/markdownlint';

import { lint as lintGeneric } from '@mnaoumov/typescript-dev-toolkit/linters/markdownlint';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';

import { getTemplateFilePath } from '../templates.ts';

/**
 * Lints the project's markdown with `markdownlint-cli2` and `linkinator`.
 *
 * @param options - The {@link LintOptions}.
 */
export async function lint(options?: LintOptions): Promise<void> {
  await lintGeneric({ defaultConfigFilePath: getTemplateFilePath(RepoPaths.MarkdownlintCli2ConfigMjs), ...options });
}
export { type LintOptions } from '@mnaoumov/typescript-dev-toolkit/linters/markdownlint';
