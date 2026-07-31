/**
 * @file
 *
 * Lint markdown documentation using `markdownlint-cli2` and `linkinator`.
 */

import { existsSync } from 'node:fs';
import {
  cp,
  glob
} from 'node:fs/promises';
import { relative } from 'node:path';

import { toArray } from '../../async.ts';
import { getLibDebugger } from '../../debug.ts';
import { ObsidianPluginRepoPaths } from '../../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import {
  getFolderName,
  join
} from '../../path.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { getNonIgnoredFiles } from '../git.ts';
import { ObsidianDevUtilsRepoPaths } from '../obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from '../root.ts';

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
 * Lint markdown documentation using `markdownlint-cli2` and `linkinator`.
 *
 * @param options - The {@link LintOptions}.
 */
export async function lint(options?: LintOptions): Promise<void> {
  const { paths, shouldFix = false } = options ?? {};
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
    const configFilePath = resolvePathFromRootSafe({ path: configFile });
    return existsSync(configFilePath);
  });

  if (!configFileExist) {
    getLibDebugger('markdownlint:lint')('markdownlint configuration file not found. Creating default config...');
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    assertNonNullable(packageFolder, 'Package folder not found');
    await cp(
      join(packageFolder, ObsidianDevUtilsRepoPaths.DistTemplates, ObsidianDevUtilsRepoPaths.MarkdownlintCli2ConfigMjs),
      resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.MarkdownlintCli2ConfigMjs })
    );
  }

  /* v8 ignore start -- The paths-provided branches are only exercised by consumer projects passing file lists. */
  const targets = paths?.length ? paths : [ObsidianPluginRepoPaths.CurrentFolder];
  /* v8 ignore stop */
  await execFromRoot(['npx', 'markdownlint-cli2', ...(shouldFix ? ['--fix'] : []), { batchedArgs: targets }]);

  /* v8 ignore start -- The paths-provided branch is only exercised by consumer projects passing file lists. */
  const rootFolder = getRootFolder() ?? process.cwd();
  const mdFiles = paths?.length
    ? paths.map((p) => relative(rootFolder, p).replace(/\\/g, '/') || p)
    : await getMarkdownFiles();
  /* v8 ignore stop */
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

/**
 * The git pathspec matching every markdown file in the repository, at any depth.
 */
const MARKDOWN_PATHSPEC = '*.md';

/**
 * Lists the markdown files to hand to `linkinator`.
 *
 * `linkinator` takes a file list rather than an ignore configuration, so the gitignored files have to be
 * dropped before it is invoked. Git itself answers that (nested ignore files, `!` negations and all); the
 * hand-maintained glob exclusions below are only the fallback for a checkout without git, and they are the
 * very lists this indirection exists to stop from drifting.
 *
 * @returns A {@link Promise} that resolves with the markdown file paths, relative to the root folder.
 */
async function getMarkdownFiles(): Promise<string[]> {
  const nonIgnoredFiles = await getNonIgnoredFiles({ patterns: [MARKDOWN_PATHSPEC] });
  if (nonIgnoredFiles) {
    return nonIgnoredFiles;
  }

  return await toArray(glob(['**/*.md'], {
    exclude: [
      '.git/**',
      'dist/**',
      '**/node_modules/**'
    ]
  }));
}
