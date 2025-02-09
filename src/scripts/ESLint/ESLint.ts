/**
 * @packageDocumentation ESLint
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
  existsSync,
  writeFile
} from '../NodeModules.ts';
import {
  execFromRoot,
  getRootDir
} from '../Root.ts';

/**
 * Lint the project with ESLint.
 *
 * @param shouldFix - Whether to fix linting issues automatically.
 */
export async function lint(shouldFix?: boolean): Promise<void> {
  shouldFix ??= false;
  const packageDir = getRootDir(getDirname(import.meta.url));
  if (!packageDir) {
    throw new Error('Could not find package directory.');
  }

  const eslintConfigMjsPath = join(packageDir, ObsidianPluginRepoPaths.EslintConfigMjs);
  if (!existsSync(eslintConfigMjsPath)) {
    console.warn(`ESLint configuration file not found at ${eslintConfigMjsPath}. Creating default config...`);
    await writeFile(eslintConfigMjsPath, 'export { configs as default } from \'obsidian-dev-utils/scripts/ESLint/eslint.config\';\n');
  }

  await execFromRoot(['eslint', ...(shouldFix ? ['--fix'] : []), '.'], { cwd: packageDir });
}
