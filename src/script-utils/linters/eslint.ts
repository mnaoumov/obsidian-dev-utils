/**
 * @file
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
import { resolveToolCommand } from '../package-manager.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from '../root.ts';

/**
 * The flags that make a WARNING count as a finding, passed on every run.
 *
 * ESLint exits `0` when a run reported warnings and no errors, so without `--max-warnings 0` the gate reads a
 * warning as a clean tree: `lint` prints it, returns success, and CI, the pre-commit hook and every sweep
 * agree the tree is clean. A warning that nothing ever fails on is a warning that stands for ever, and the
 * fleet has carried several that each needed a person rather than a gate to notice them.
 *
 * It is passed unconditionally and there is no option to raise it: a ceiling a repo can raise is a gate
 * somebody turns off. It is passed on the `--fix` runs too, because whatever is left after fixing is exactly
 * what the no-fix run would have judged, so the two cannot disagree about what counts. It is a static command
 * part rather than a batched argument, so every batch of a split command line carries it.
 *
 * `--no-warn-ignored` has to travel with it. The pre-commit hook hands ESLint explicit file lists, and ESLint
 * reports an explicitly passed, globally ignored path (a `templates/` file, say) as a WARNING rather than
 * skipping it. Under `--max-warnings 0` that warning alone would fail the commit, although it says nothing
 * about the code.
 */
const ESLINT_WARNINGS_AS_FINDINGS_ARGUMENTS: readonly string[] = ['--max-warnings', '0', '--no-warn-ignored'];

/**
 * Parameters for the {@link lint} function.
 */
export interface LintOptions {
  /**
   * Optional file paths to lint. If omitted, lints the entire project.
   */
  readonly paths?: string[] | undefined;

  /**
   * Whether to fix linting issues automatically.
   *
   * @default `false`
   */
  readonly shouldFix?: boolean | undefined;
}

/**
 * Lint the project with ESLint.
 *
 * @param options - The {@link LintOptions}.
 */
export async function lint(options?: LintOptions): Promise<void> {
  const { paths, shouldFix } = options ?? {};
  const configFiles = [
    ObsidianPluginRepoPaths.EslintConfigJs,
    ObsidianPluginRepoPaths.EslintConfigMjs,
    ObsidianPluginRepoPaths.EslintConfigCjs,
    ObsidianPluginRepoPaths.EslintConfigTs,
    ObsidianPluginRepoPaths.EslintConfigMts,
    ObsidianPluginRepoPaths.EslintConfigCts
  ];

  const doesConfigFileExist = configFiles.some((configFile) => {
    const configFilePath = resolvePathFromRootSafe({ path: configFile });
    return existsSync(configFilePath);
  });

  if (!doesConfigFileExist) {
    getLibDebugger('ESLint:lint')('ESLint configuration file not found. Creating default config...');
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    assertNonNullable(packageFolder, 'Package folder not found');
    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.DistTemplates, ObsidianDevUtilsRepoPaths.EslintConfigMts),
      resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.EslintConfigMts })
    );
  }

  /* v8 ignore start -- The paths-provided branch is only exercised by consumer projects passing file lists. */
  const targets = paths?.length ? paths : [ObsidianPluginRepoPaths.CurrentFolder];
  /* v8 ignore stop */
  await execFromRoot([
    ...resolveToolCommand({ tool: 'eslint' }),
    ...ESLINT_WARNINGS_AS_FINDINGS_ARGUMENTS,
    ...(shouldFix ? ['--fix'] : []),
    { batchedArguments: targets }
  ]);
}
