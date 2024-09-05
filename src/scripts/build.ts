/**
 * @packageDocumentation build
 * This module provides utility functions to handle the build process for static assets and cleaning
 * the build output directory. It includes functions to copy static files to the distribution directory
 * and to remove the existing build output.
 */

import { join } from '../Path.ts';
import { trimStart } from '../String.ts';
import { readdirPosix } from './Fs.ts';
import {
  cp,
  rm
} from './NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from './ObsidianDevUtilsRepoPaths.ts';

/**
 * Copies all static files from the static assets directory to the distribution directory.
 *
 * This function recursively reads the contents of the static assets directory and copies
 * each file to the corresponding path in the distribution directory.
 *
 * @returns A promise that resolves when all files have been copied.
 */
export async function buildStatic(): Promise<void> {
  for (const dirent of await readdirPosix(ObsidianDevUtilsRepoPaths.Static, { withFileTypes: true, recursive: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const path = trimStart(join(dirent.parentPath, dirent.name), ObsidianDevUtilsRepoPaths.Static + '/');
    await cp(join(ObsidianDevUtilsRepoPaths.Static, path), join(ObsidianDevUtilsRepoPaths.Dist, path));
  }
}

/**
 * Removes the distribution directory and its contents.
 *
 * This function deletes the entire distribution directory to ensure a clean build environment.
 *
 * @returns A promise that resolves when the directory has been removed.
 */
export async function buildClean(): Promise<void> {
  await rm(ObsidianDevUtilsRepoPaths.Dist, { recursive: true, force: true });
}
