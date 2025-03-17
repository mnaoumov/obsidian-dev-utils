/**
 * @packageDocumentation build
 * This module provides utility functions to handle the build process for static assets and cleaning
 * the build output directory. It includes functions to copy static files to the distribution directory
 * and to remove the existing build output.
 */

import type { TsConfigJson } from 'type-fest';

import { glob } from 'glob';

import { getLibDebugger } from '../Debug.ts';
import { join } from '../Path.ts';
import { trimStart } from '../String.ts';
import { readdirPosix } from './Fs.ts';
import { readJson } from './JSON.ts';
import {
  cp,
  rm
} from './NodeModules.ts';
import { npmRun } from './NpmRun.ts';
import { ObsidianDevUtilsRepoPaths } from './ObsidianDevUtilsRepoPaths.ts';
import {
  execFromRoot,
  resolvePathFromRootSafe
} from './Root.ts';

/**
 * Removes the distribution directory and its contents.
 *
 * This function deletes the entire distribution directory to ensure a clean build environment.
 *
 * @returns A promise that resolves when the directory has been removed.
 */
export async function buildClean(): Promise<void> {
  await rm(ObsidianDevUtilsRepoPaths.Dist, { force: true, recursive: true });
}

/**
 * Compiles the code.
 *
 * @returns A promise that resolves when the code compiles successfully.
 */
export async function buildCompile(): Promise<void> {
  await npmRun('build:compile:svelte');
  await npmRun('build:compile:typescript');
}

/**
 * Compiles the Svelte code.
 *
 * @returns A promise that resolves when the code compiles successfully.
 */
export async function buildCompileSvelte(): Promise<void> {
  const tsConfigPath = resolvePathFromRootSafe(ObsidianDevUtilsRepoPaths.TsConfigJson);
  const tsConfig = await readJson<TsConfigJson>(tsConfigPath);
  const allFiles = await glob(tsConfig.include ?? [], { ignore: tsConfig.exclude ?? [] });
  const svelteFiles = allFiles.filter((file) => file.endsWith('.svelte') || file.endsWith('.svelte.js') || file.endsWith('.svelte.ts'));

  if (svelteFiles.length === 0) {
    getLibDebugger('build:buildCompileSvelte')('No Svelte files found in the project, skipping Svelte compilation');
    return;
  }

  await execFromRoot(['svelte-check', '--tsconfig', ObsidianDevUtilsRepoPaths.TsConfigJson]);
}

/**
 * Compiles the TypeScript code.
 *
 * @returns A promise that resolves when the code compiles successfully.
 */
export async function buildCompileTypeScript(): Promise<void> {
  await execFromRoot(['tsc', '--build', '--force']);
}

/**
 * Copies all static files from the static assets directory to the distribution directory.
 *
 * This function recursively reads the contents of the static assets directory and copies
 * each file to the corresponding path in the distribution directory.
 *
 * @returns A promise that resolves when all files have been copied.
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
