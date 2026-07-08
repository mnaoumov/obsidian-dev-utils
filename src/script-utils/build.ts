/**
 * @file
 *
 * This module provides utility functions to handle the build process for static assets and cleaning
 * the build output folder. It includes functions to copy static files to the distribution folder
 * and to remove the existing build output.
 */

import type { TsConfigJson } from 'type-fest';

import { existsSync } from 'node:fs';
import {
  cp,
  glob,
  rm
} from 'node:fs/promises';

import { toArray } from '../async.ts';
import { getLibDebugger } from '../debug.ts';
import { join } from '../path.ts';
import { trimStart } from '../string.ts';
import {
  checkProjectTypes,
  parseTsConfig,
  toCanonical
} from './check-project-types.ts';
import { readdirPosix } from './fs.ts';
import { readJson } from './json.ts';
import { npmRunOptional } from './npm-run.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from './root.ts';

/**
 * Removes the distribution folder and its contents.
 *
 * This function deletes the entire distribution folder to ensure a clean build environment.
 *
 * @returns A {@link Promise} that resolves when the folder has been removed.
 */
export async function buildClean(): Promise<void> {
  await rm(ObsidianDevUtilsRepoPaths.Dist, { force: true, recursive: true });
}

/**
 * Compiles the code.
 *
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 */
export async function buildCompile(): Promise<void> {
  if (!await npmRunOptional('build:compile:svelte')) {
    await buildCompileSvelte();
  }
  if (!await npmRunOptional('build:compile:typescript')) {
    await buildCompileTypeScript();
  }
}

/**
 * Compiles the Svelte code.
 *
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 */
export async function buildCompileSvelte(): Promise<void> {
  const tsConfigPath = resolvePathFromRootSafe({ path: ObsidianDevUtilsRepoPaths.TsConfigJson });
  const tsConfig = await readJson<TsConfigJson>(tsConfigPath);
  const allFiles = await toArray(glob(tsConfig.include ?? [], { exclude: tsConfig.exclude ?? [] }));
  const svelteFiles = allFiles.filter((file) => file.endsWith('.svelte') || file.endsWith('.svelte.js') || file.endsWith('.svelte.ts'));

  if (svelteFiles.length === 0) {
    getLibDebugger('build:buildCompileSvelte')('No Svelte files found in the project, skipping Svelte compilation');
    return;
  }

  await execFromRoot(['npx', 'svelte-check', '--tsconfig', ObsidianDevUtilsRepoPaths.TsConfigJson]);
}

/**
 * Compiles the TypeScript code.
 *
 * The general `tsc` pass runs with `skipLibCheck: true` (configured in `tsconfig.json`) so it does
 * not fail on broken upstream `.d.ts` files we do not control. Afterwards, {@link validateProjectTypes}
 * re-runs the type-check in-memory with `skipLibCheck: false`, reporting only diagnostics from the
 * files we own, so the declarations we author are still fully validated.
 *
 * When the `typescript-7` alias (`npm:typescript@7`, the native `tsgo` port) is installed, its faster
 * compiler runs the `tsc --build` pass; otherwise the project's default `tsc` is used. The
 * {@link validateProjectTypes} second pass runs on the project's default TypeScript regardless, since
 * it depends on the classic compiler API (unavailable in `typescript@7`).
 *
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 * @throws If the project's own declarations fail validation.
 */
export async function buildCompileTypeScript(): Promise<void> {
  await execFromRoot([...getTypeScriptCompilerCommand(), '--build', '--force']);

  if (!validateProjectTypes()) {
    throw new Error('TypeScript declaration validation failed.');
  }
}

/**
 * Copies all template files from the templates folder to the `templates` folder within the
 * distribution folder.
 *
 * This function recursively reads the contents of the templates folder and copies each file to the
 * corresponding path under {@link ObsidianDevUtilsRepoPaths.DistTemplates}, so consumers can copy the
 * templates from `node_modules/obsidian-dev-utils/dist/templates`. A trailing `.template` on a source
 * file name is stripped in the destination (e.g. `eslint.config.mts.template` is copied as
 * `eslint.config.mts`), so an active config template can live in the repo under a name that the
 * corresponding tool does not auto-discover.
 *
 * @returns A {@link Promise} that resolves when all files have been copied.
 */
export async function buildTemplates(): Promise<void> {
  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.Templates, { recursive: true, withFileTypes: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const path = trimStart({
      prefix: `${ObsidianDevUtilsRepoPaths.Templates}/`,
      str: join(dirent.parentPath, dirent.name)
    });
    const destinationPath = path.endsWith(TEMPLATE_FILE_SUFFIX) ? path.slice(0, -TEMPLATE_FILE_SUFFIX.length) : path;
    await cp(join(ObsidianDevUtilsRepoPaths.Templates, path), join(ObsidianDevUtilsRepoPaths.DistTemplates, destinationPath));
  }
}

const TEMPLATE_FILE_SUFFIX = '.template';

const NODE_MODULES_SEGMENT = '/node_modules/';

const TYPESCRIPT_7_TSC_BIN_PATH = 'node_modules/typescript-7/bin/tsc';

/**
 * Parameters for {@link shouldKeepProjectFile}.
 */
interface ShouldKeepProjectFileParams {
  /**
   * Absolute path of the file under consideration.
   */
  readonly fileName: string;

  /**
   * Absolute (canonical) path of the project root.
   */
  readonly rootCanonical: string;
}

/**
 * Resolves the command used to run the `tsc --build` pass. Prefers the `typescript-7` alias
 * (`npm:typescript@7`, the native `tsgo` port) when it is installed, falling back to the project's
 * default `tsc`.
 *
 * @returns The command argument list (without the trailing `tsc` flags).
 */
function getTypeScriptCompilerCommand(): string[] {
  const typeScript7TscBinPath = resolvePathFromRootSafe({ path: TYPESCRIPT_7_TSC_BIN_PATH });
  if (existsSync(typeScript7TscBinPath)) {
    return ['node', typeScript7TscBinPath];
  }

  return ['npx', 'tsc'];
}

/**
 * Determines whether a file belongs to the project (under the root folder, outside `node_modules`).
 *
 * @param params - The parameters for the check.
 * @returns `true` when the file belongs to the project.
 */
function shouldKeepProjectFile(params: ShouldKeepProjectFileParams): boolean {
  const { fileName, rootCanonical } = params;
  return fileName.startsWith(`${rootCanonical}/`) && !fileName.includes(NODE_MODULES_SEGMENT);
}

/**
 * Re-runs the project type-check in-memory with `skipLibCheck: false`, reporting only diagnostics
 * whose source file belongs to the project (under the root folder, outside `node_modules`).
 *
 * @returns `true` when the project's own files have no type errors, `false` otherwise.
 * @throws If the root folder cannot be found.
 */
function validateProjectTypes(): boolean {
  const root = getRootFolder();

  if (!root) {
    throw new Error('Could not find root folder');
  }

  const rootCanonical = toCanonical(root);
  const { fileNames, options } = parseTsConfig(join(root, ObsidianDevUtilsRepoPaths.TsConfigJson));

  return checkProjectTypes({
    options,
    rootNames: fileNames,
    shouldKeepFile: (fileName) => shouldKeepProjectFile({ fileName, rootCanonical })
  });
}
