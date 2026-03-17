/**
 * @packageDocumentation
 *
 * Linting utility for ESLint configuration with support for automatic fixing.
 *
 * This module provides a function to lint files based on the ESLint configuration defined in `eslint.config.ts`.
 * It can automatically fix linting issues if specified, and logs results to the console.
 */

import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';

import { getLibDebugger } from '../../debug.ts';
import { ObsidianPluginRepoPaths } from '../../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import {
  getFolderName,
  join
} from '../../path.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { ObsidianDevUtilsRepoPaths } from '../obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from '../root.ts';

/**
 * Parameters for the {@link lint} function.
 */
export interface LintParams {
  /**
   * Optional file paths to lint. If omitted, lints the entire project.
   */
  paths?: string[] | undefined;

  /**
   * Whether to fix linting issues automatically.
   */
  shouldFix?: boolean | undefined;
}

/**
 * Lint the project with ESLint.
 *
 * @param params - The {@link LintParams}.
 */
export async function lint(params?: LintParams): Promise<void> {
  const { paths, shouldFix } = params ?? {};
  const configFiles = [
    ObsidianPluginRepoPaths.EslintConfigJs,
    ObsidianPluginRepoPaths.EslintConfigMjs,
    ObsidianPluginRepoPaths.EslintConfigCjs,
    ObsidianPluginRepoPaths.EslintConfigTs,
    ObsidianPluginRepoPaths.EslintConfigMts,
    ObsidianPluginRepoPaths.EslintConfigCts
  ];

  const configFileExist = configFiles.some((configFile) => {
    const configFilePath = resolvePathFromRootSafe(configFile);
    return existsSync(configFilePath);
  });

  if (!configFileExist) {
    getLibDebugger('ESLint:lint')('ESLint configuration file not found. Creating default config...');
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    assertNonNullable(packageFolder, 'Package folder not found');
    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.EslintConfigMts),
      resolvePathFromRootSafe(ObsidianPluginRepoPaths.EslintConfigMts)
    );
  }

  /* v8 ignore start -- The paths-provided branch is only exercised by consumer projects passing file lists. */
  const targets = paths?.length ? paths : [ObsidianPluginRepoPaths.CurrentFolder];
  /* v8 ignore stop */
  await execFromRoot(['npx', 'eslint', ...(shouldFix ? ['--fix'] : []), { batchedArgs: targets }]);
}
