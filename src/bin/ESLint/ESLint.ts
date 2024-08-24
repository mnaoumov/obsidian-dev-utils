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
} from "eslint";
import { configs as defaultConfigs } from "./eslint.config.ts";
import {
  join,
  normalizeIfRelative
} from "../../Path.ts";
import { packageDirectory } from "pkg-dir";
import { toRelativeFromRoot } from "../../Root.ts";
import { getDirname } from "../../Path.ts";
import { CliTaskResult } from "../../cli.ts";
import { ObsidianDevUtilsRepoPaths } from "../ObsidianDevUtilsRepoPaths.ts";
import { glob } from "glob";

/**
 * Lints files according to the ESLint configurations and applies automatic fixes if specified.
 *
 * @param {boolean} [fix=false] - Whether to automatically fix linting issues. Defaults to false.
 * @returns {Promise<CliTaskResult>} - A promise that resolves to a TaskResult indicating success or failure.
 *
 * @throws {Error} If the package directory cannot be found.
 */
export async function lint(fix?: boolean, customConfigs?: Linter.Config[]): Promise<CliTaskResult> {
  fix ??= false;
  const packageDir = await packageDirectory({ cwd: getDirname(import.meta.url) });
  if (!packageDir) {
    throw new Error("Could not find package directory.");
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
  const lintResults = await eslint.lintFiles(files);

  if (fix) {
    await FlatESLint.outputFixes(lintResults);
  }

  lintResults.sort((a, b) => a.filePath.localeCompare(b.filePath));

  let isSuccess = true;

  for (const lintResult of lintResults) {
    if (lintResult.errorCount > 0 || lintResult.fatalErrorCount > 0 || lintResult.fixableErrorCount > 0) {
      isSuccess = false;
    }

    if (lintResult.output) {
      console.log(`${toRelativeFromRoot(lintResult.filePath)} - had some issues that were fixed automatically.`);
      isSuccess = false;
    }

    for (const message of lintResult.messages) {
      const canAutoFix = message.fix !== undefined;
      console.log(`${toRelativeFromRoot(lintResult.filePath)}:${message.line}:${message.column} - ${message.message} [rule ${message.ruleId}]${canAutoFix ? " (auto-fixable)" : ""}`);
    }
  }

  return CliTaskResult.Success(isSuccess);
}
