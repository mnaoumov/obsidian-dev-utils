/**
 * @packageDocumentation
 *
 * Lint markdown documentation using `markdownlint-cli2` and `linkinator`.
 */

import { toArray } from '../../Async.ts';
import { getLibDebugger } from '../../Debug.ts';
import { ObsidianPluginRepoPaths } from '../../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import {
  getFolderName,
  join
} from '../../Path.ts';
import {
  cp,
  existsSync,
  glob
} from '../NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from '../Root.ts';

/**
 * Lint markdown documentation using `markdownlint-cli2` and `linkinator`.
 *
 * @param shouldFix - Whether to fix linting issues automatically.
 */
export async function lintMarkdown(shouldFix = false): Promise<void> {
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
    getLibDebugger('markdownlint:lintMarkdown')('markdownlint configuration file not found. Creating default config...');
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    if (!packageFolder) {
      throw new Error('Package folder not found');
    }
    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.MarkdownlintCli2ConfigMjs),
      resolvePathFromRootSafe(ObsidianPluginRepoPaths.MarkdownlintCli2ConfigMjs)
    );

    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.MarkdownlintCli2ConfigMts),
      resolvePathFromRootSafe(ObsidianPluginRepoPaths.MarkdownlintCli2ConfigMts)
    );
  }

  await execFromRoot(['npx', 'markdownlint-cli2', ...(shouldFix ? ['--fix'] : []), ObsidianPluginRepoPaths.CurrentFolder]);

  const mdFiles = await toArray(glob(['**/*.md'], {
    exclude: [
      '.git/**',
      'dist/**',
      'node_modules/**'
    ]
  }));
  await execFromRoot([
    'npx',
    'linkinator',
    ...mdFiles,
    '--retry',
    '--retry-errors',
    '--url-rewrite-search',
    'https://www\\.npmjs\\.com/package/',
    '--url-rewrite-replace',
    'https://registry.npmjs.org/'
  ]);
}
