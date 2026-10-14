/**
 * @file
 *
 * Lint markdown documentation using `markdownlint-cli2` and `linkinator`.
 */

import { toArray } from '@mnaoumov/typescript-lib/async';
import { getLibDebugger } from '@mnaoumov/typescript-lib/debug';
import { basename } from '@mnaoumov/typescript-lib/path';
import { existsSync } from 'node:fs';
import {
  cp,
  glob
} from 'node:fs/promises';
import { relative } from 'node:path';

import { getNonIgnoredFiles } from '../git.ts';
import { resolveToolCommand } from '../package-manager.ts';
import { RepoPaths } from '../repo-paths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from '../root.ts';
import {
  checkIsInNodeModules,
  NODE_MODULES_IGNORE_GLOB
} from './markdownlint-ignores.ts';

/**
 * Parameters for the {@link lint} function.
 */
export interface LintOptions {
  /**
   * The configuration file copied to the project root when the project has none. Without it,
   * `markdownlint-cli2` runs with its own defaults.
   */
  readonly defaultConfigFilePath?: string | undefined;

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
  const { defaultConfigFilePath, paths, shouldFix = false } = options ?? {};
  const configFiles = [
    RepoPaths.MarkdownlintCli2ConfigJsonc,
    RepoPaths.MarkdownlintCli2ConfigYaml,
    RepoPaths.MarkdownlintCli2ConfigCjs,
    RepoPaths.MarkdownlintCli2ConfigMjs,
    RepoPaths.MarkdownlintConfigJsonc,
    RepoPaths.MarkdownlintConfigJson,
    RepoPaths.MarkdownlintConfigYaml,
    RepoPaths.MarkdownlintConfigYml,
    RepoPaths.MarkdownlintConfigCjs,
    RepoPaths.MarkdownlintConfigMjs
  ];

  const doesConfigFileExist = configFiles.some((configFile) => {
    const configFilePath = resolvePathFromRootSafe({ path: configFile });
    return existsSync(configFilePath);
  });

  if (!doesConfigFileExist && defaultConfigFilePath) {
    getLibDebugger('markdownlint:lint')('markdownlint configuration file not found. Creating default config...');
    await cp(defaultConfigFilePath, resolvePathFromRootSafe({ path: basename(defaultConfigFilePath) }));
  }

  /* v8 ignore start -- The paths-provided branches are only exercised by consumer projects passing file lists. */
  const targets = paths?.length ? paths : [RepoPaths.CurrentFolder];
  /* v8 ignore stop */
  await execFromRoot([...resolveToolCommand({ tool: 'markdownlint-cli2' }), ...(shouldFix ? ['--fix'] : []), { batchedArguments: targets }]);

  /* v8 ignore start -- The paths-provided branch is only exercised by consumer projects passing file lists. */
  const rootFolder = getRootFolder() ?? process.cwd();
  const mdFiles = paths?.length
    ? paths.map((p) => relative(rootFolder, p).replaceAll('\\', '/') || p)
    : await getMarkdownFiles();
  /* v8 ignore stop */
  await execFromRoot([
    ...resolveToolCommand({ tool: 'linkinator' }),
    '--retry',
    '--retry-errors',
    '--retry-errors-count',
    '3',
    '--retry-errors-jitter',
    '5',
    '--url-rewrite-search',
    String.raw`https://www\.npmjs\.com/package/`,
    '--url-rewrite-replace',
    'https://registry.npmjs.org/',
    { batchedArguments: mdFiles }
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
 * The `node_modules` filter is applied to the git-derived list too, and deliberately so: git only skips
 * what the repository asked it to skip, and a repository can deliberately TRACK a vendored `node_modules`
 * tree. That is the one exclusion `.gitignore` cannot answer — see `markdownlint-ignores.ts`. Applying it
 * here keeps `linkinator` in step with the markdownlint half, which ignores the same paths by glob.
 *
 * @returns A {@link Promise} that resolves with the markdown file paths, relative to the root folder.
 */
async function getMarkdownFiles(): Promise<string[]> {
  const nonIgnoredFiles = await getNonIgnoredFiles({ patterns: [MARKDOWN_PATHSPEC] });
  return nonIgnoredFiles
    ? nonIgnoredFiles.filter((path) => !checkIsInNodeModules(path))
    : (await toArray(glob(['**/*.md'], {
      exclude: [
        '.git/**',
        'dist/**',
        NODE_MODULES_IGNORE_GLOB
      ]
    })));
}
