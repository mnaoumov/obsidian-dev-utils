/**
 * @packageDocumentation
 *
 * This module provides utility functions to handle the build process for static assets and cleaning
 * the build output folder. It includes functions to copy static files to the distribution folder
 * and to remove the existing build output.
 */

import type { TsConfigJson } from 'type-fest';

import {
  cp,
  glob,
  rm
} from 'node:fs/promises';

import { toArray } from '../async.ts';
import { getLibDebugger } from '../debug.ts';
import { join } from '../path.ts';
import { trimStart } from '../string.ts';
import { readdirPosix } from './fs.ts';
import { readJson } from './json.ts';
import { npmRun } from './npm-run.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import {
  execFromRoot,
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
  await npmRun('build:compile:svelte');
  await npmRun('build:compile:typescript');
}

/**
 * Compiles the Svelte code.
 *
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 */
export async function buildCompileSvelte(): Promise<void> {
  const tsConfigPath = resolvePathFromRootSafe(ObsidianDevUtilsRepoPaths.TsConfigJson);
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
 * @returns A {@link Promise} that resolves when the code compiles successfully.
 */
export async function buildCompileTypeScript(): Promise<void> {
  await execFromRoot(['npx', 'tsc', '--build', '--force']);
}

/**
 * Copies all static files from the static assets folder to the distribution folder.
 *
 * This function recursively reads the contents of the static assets folder and copies
 * each file to the corresponding path in the distribution folder.
 *
 * @returns A {@link Promise} that resolves when all files have been copied.
 */
export async function buildStatic(): Promise<void> {
  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.Static, { recursive: true, withFileTypes: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const path = trimStart(join(dirent.parentPath, dirent.name), `${ObsidianDevUtilsRepoPaths.Static}/`);
    await cp(join(ObsidianDevUtilsRepoPaths.Static, path), join(ObsidianDevUtilsRepoPaths.Dist, path));
  }
}
