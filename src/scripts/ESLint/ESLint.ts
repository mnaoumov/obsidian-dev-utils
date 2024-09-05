/**
 * @packageDocumentation ESLint
 * Linting utility for ESLint configuration with support for automatic fixing.
 *
 * This module provides a function to lint files based on the ESLint configuration defined in `eslint.config.ts`.
 * It can automatically fix linting issues if specified, and logs results to the console.
 */

import {
  Linter,
  loadESLint
} from 'eslint';
import { glob } from 'glob';
import { packageDirectory } from 'pkg-dir';

import {
  getDirname,
  join,
  normalizeIfRelative
} from '../../Path.ts';
import { CliTaskResult } from '../CliUtils.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';
import { toRelativeFromRoot } from '../Root.ts';
import { configs as defaultConfigs } from './eslint.config.ts';

/**
 * Lints files according to the ESLint configurations and applies automatic fixes if specified.
 *
 * @param fix - Whether to automatically fix linting issues. Defaults to false.
 * @param customConfigs - Custom ESLint configurations to merge with the default configurations.
 * @returns A promise that resolves to a CliTaskResult indicating success or failure.
 *
 * @throws If the package directory cannot be found.
 */
export async function lint(fix?: boolean, customConfigs?: Linter.Config[]): Promise<CliTaskResult> {
  fix ??= false;
  const packageDir = await packageDirectory({ cwd: getDirname(import.meta.url) });
  if (!packageDir) {
    throw new Error('Could not find package directory.');
  }

  const configs = [...defaultConfigs, ...customConfigs ?? []];
  const FlatESLint = await loadESLint({ useFlatConfig: true });
  const eslint = new FlatESLint({
    fix,
    overrideConfigFile: join(packageDir, ObsidianDevUtilsRepoPaths.DistEslintConfigEmptyCjs),
    overrideConfig: configs
  });

  const includePatterns = configs
    .flatMap((config) => config.files ?? [])
    .flatMap((file) => file instanceof Array ? file : [file])
    .map((file) => normalizeIfRelative(file));

  const ignorePatterns = configs.flatMap((config) => config.ignores ?? []).flatMap((pattern) => [pattern, join(pattern, ObsidianDevUtilsRepoPaths.AnyPath)]);
  const files = await glob(includePatterns, { ignore: ignorePatterns });
  const lintResults = files.length > 0 ? await eslint.lintFiles(files) : [];

  if (fix) {
    await FlatESLint.outputFixes(lintResults);
  }

  lintResults.sort((a, b) => a.filePath.localeCompare(b.filePath));

  let errorsCount = 0;

  for (const lintResult of lintResults) {
    if (lintResult.output) {
      console.log(`${toRelativeFromRoot(lintResult.filePath)} - had some issues that were fixed automatically.`);
      errorsCount++;
    }

    for (const message of lintResult.messages) {
      const canAutoFix = message.fix !== undefined;
      console.log(`${toRelativeFromRoot(lintResult.filePath)}:${(message.line as number | null)?.toString() ?? '(null)'}:${(message.column as number | null)?.toString() ?? '(null)'} - ${message.message} [rule ${message.ruleId ?? '(null)'}]${canAutoFix ? ' (auto-fixable)' : ''}`);
      errorsCount++;
    }
  }

  console.log(`Linted ${lintResults.length.toString()} files with ${errorsCount.toString()} issues.`);
  return CliTaskResult.Success(errorsCount === 0);
}
