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

import { getLibDebugger } from '../../Debug.ts';
import {
  getDirname,
  join,
  normalizeIfRelative
} from '../../Path.ts';
import { CliTaskResult } from '../CliUtils.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';
import {
  getRootDir,
  toRelativeFromRoot
} from '../Root.ts';
import { configs as defaultConfigs } from './eslint.config.ts';

/**
 * Lints files according to the ESLint configurations and applies automatic fixes if specified.
 *
 * @param shouldFix - Whether to automatically fix linting issues. Defaults to false.
 * @param customConfigs - Custom ESLint configurations to merge with the default configurations.
 * @returns A promise that resolves to a CliTaskResult indicating success or failure.
 *
 * @throws If the package directory cannot be found.
 */
export async function lint(shouldFix?: boolean, customConfigs?: Linter.Config[]): Promise<CliTaskResult> {
  shouldFix ??= false;
  const packageDir = getRootDir(getDirname(import.meta.url));
  if (!packageDir) {
    throw new Error('Could not find package directory.');
  }

  const configs = [...defaultConfigs, ...customConfigs ?? []];
  const FlatESLint = await loadESLint({ useFlatConfig: true });
  const eslint = new FlatESLint({
    fix: shouldFix,
    overrideConfig: configs,
    overrideConfigFile: join(packageDir, ObsidianDevUtilsRepoPaths.DistEslintConfigEmptyCjs)
  });

  const includePatterns = configs
    .flatMap((config) => config.files ?? [])
    .flatMap((file) => Array.isArray(file) ? file : [file])
    .map((file) => normalizeIfRelative(file));

  const ignorePatterns = configs.flatMap((config) => config.ignores ?? []).flatMap((pattern) => [pattern, join(pattern, ObsidianDevUtilsRepoPaths.AnyPath)]);
  const files = await glob(includePatterns, { ignore: ignorePatterns });
  const lintResults = files.length > 0 ? await eslint.lintFiles(files) : [];

  if (shouldFix) {
    await FlatESLint.outputFixes(lintResults);
  }

  lintResults.sort((a, b) => a.filePath.localeCompare(b.filePath));

  let errorsCount = 0;
  const _debugger = getLibDebugger('ESLint');

  for (const lintResult of lintResults) {
    if (lintResult.output) {
      _debugger(`${toRelativeFromRoot(lintResult.filePath) ?? lintResult.filePath} - had some issues that were fixed automatically.`);
      errorsCount++;
    }

    for (const message of lintResult.messages) {
      const canAutoFix = message.fix !== undefined;
      _debugger(`${toRelativeFromRoot(lintResult.filePath) ?? lintResult.filePath}:${(message.line as null | number)?.toString() ?? '(null)'}:${(message.column as null | number)?.toString() ?? '(null)'} - ${message.message} [rule ${message.ruleId ?? '(null)'}]${canAutoFix ? ' (auto-fixable)' : ''}`);
      errorsCount++;
    }
  }

  _debugger(`Linted ${lintResults.length.toString()} files with ${errorsCount.toString()} issues.`);
  return CliTaskResult.Success(errorsCount === 0);
}
