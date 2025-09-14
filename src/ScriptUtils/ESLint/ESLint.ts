/**
 * @packageDocumentation
 *
 * Linting utility for ESLint configuration with support for automatic fixing.
 *
 * This module provides a function to lint files based on the ESLint configuration defined in `eslint.config.ts`.
 * It can automatically fix linting issues if specified, and logs results to the console.
 */

import { getLibDebugger } from '../../Debug.ts';
import { ObsidianPluginRepoPaths } from '../../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import {
  getFolderName,
  join
} from '../../Path.ts';
import {
  cp,
  existsSync
} from '../NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from '../Root.ts';

/**
 * Lint the project with ESLint.
 *
 * @param shouldFix - Whether to fix linting issues automatically.
 */
export async function lint(shouldFix?: boolean): Promise<void> {
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
    if (!packageFolder) {
      throw new Error('Package folder not found');
    }
    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.EslintConfigMts),
      resolvePathFromRootSafe(ObsidianPluginRepoPaths.EslintConfigMts)
    );
  }

  await execFromRoot(['npx', 'eslint', ...(shouldFix ? ['--fix'] : []), ObsidianPluginRepoPaths.CurrentFolder]);
}
