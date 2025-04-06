/**
 * @packageDocumentation
 *
 * Linting utility for ESLint configuration with support for automatic fixing.
 *
 * This module provides a function to lint files based on the ESLint configuration defined in `eslint.config.ts`.
 * It can automatically fix linting issues if specified, and logs results to the console.
 */

import { ObsidianPluginRepoPaths } from '../../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import {
  getDirname,
  join
} from '../../Path.ts';
import {
  cp,
  existsSync
} from '../NodeModules.ts';
import {
  execFromRoot,
  getRootDir,
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
    console.warn('ESLint configuration file not found. Creating default config...');
    const packageDir = getRootDir(getDirname(import.meta.url));
    if (!packageDir) {
      throw new Error('Package directory not found');
    }
    await cp(join(packageDir, ObsidianPluginRepoPaths.EslintConfigMts), resolvePathFromRootSafe(ObsidianPluginRepoPaths.EslintConfigMts));
  }

  await execFromRoot(['npx', 'eslint', ...(shouldFix ? ['--fix'] : []), ObsidianPluginRepoPaths.CurrentDir]);
}
