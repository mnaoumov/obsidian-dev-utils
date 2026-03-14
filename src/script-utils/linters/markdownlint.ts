/**
 * @packageDocumentation
 *
 * Lint markdown documentation using `markdownlint-cli2` and `linkinator`.
 */

import { existsSync } from 'node:fs';
import {
  cp,
  glob
} from 'node:fs/promises';

import { toArray } from '../../async.ts';
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
 * Lint markdown documentation using `markdownlint-cli2` and `linkinator`.
 *
 * @param params - The {@link LintParams}.
 */
export async function lint(params?: LintParams): Promise<void> {
  const { paths, shouldFix = false } = params ?? {};
  const configFiles = [
    ObsidianPluginRepoPaths.MarkdownlintCli2ConfigJsonc,
    ObsidianPluginRepoPaths.MarkdownlintCli2ConfigYaml,
    ObsidianPluginRepoPaths.MarkdownlintCli2ConfigCjs,
    ObsidianPluginRepoPaths.MarkdownlintCli2ConfigMjs,
    ObsidianPluginRepoPaths.MarkdownlintConfigJsonc,
    ObsidianPluginRepoPaths.MarkdownlintConfigJson,
    ObsidianPluginRepoPaths.MarkdownlintConfigYaml,
    ObsidianPluginRepoPaths.MarkdownlintConfigYml,
    ObsidianPluginRepoPaths.MarkdownlintConfigCjs,
    ObsidianPluginRepoPaths.MarkdownlintConfigMjs
  ];

  const configFileExist = configFiles.some((configFile) => {
    const configFilePath = resolvePathFromRootSafe(configFile);
    return existsSync(configFilePath);
  });

  if (!configFileExist) {
    getLibDebugger('markdownlint:lint')('markdownlint configuration file not found. Creating default config...');
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    assertNonNullable(packageFolder, 'Package folder not found');
    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.MarkdownlintCli2ConfigMjs),
      resolvePathFromRootSafe(ObsidianPluginRepoPaths.MarkdownlintCli2ConfigMjs)
    );

    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.MarkdownlintCli2ConfigMts),
      resolvePathFromRootSafe(ObsidianPluginRepoPaths.MarkdownlintCli2ConfigMts)
    );
  }

  const targets = paths?.length ? paths : [ObsidianPluginRepoPaths.CurrentFolder];
  await execFromRoot(['npx', 'markdownlint-cli2', ...(shouldFix ? ['--fix'] : []), { batchedArgs: targets }]);

  const mdFiles = paths?.length
    ? paths
    : await toArray(glob(['**/*.md'], {
      exclude: [
        '.git/**',
        'dist/**',
        'node_modules/**'
      ]
    }));
  await execFromRoot([
    'npx',
    'linkinator',
    '--retry',
    '--retry-errors',
    '--retry-errors-count',
    '3',
    '--retry-errors-jitter',
    '5',
    '--url-rewrite-search',
    'https://www\\.npmjs\\.com/package/',
    '--url-rewrite-replace',
    'https://registry.npmjs.org/',
    { batchedArgs: mdFiles }
  ]);
}
