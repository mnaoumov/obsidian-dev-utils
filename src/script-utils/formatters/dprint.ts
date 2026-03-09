/**
 * @packageDocumentation
 *
 * Format the source code.
 */

import { existsSync } from 'node:fs';

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
 * Format the source code.
 *
 * @param rewrite - Whether to rewrite the source code.
 * @returns A {@link Promise} that resolves when the source code has been formatted.
 */
export async function format(rewrite = true): Promise<void> {
  const rootFolder = getRootFolder();
  assertNonNullable(rootFolder, 'Root folder not found');
  let dprintJsonPath = resolvePathFromRootSafe(ObsidianDevUtilsRepoPaths.DprintJson);
  if (!existsSync(dprintJsonPath)) {
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    assertNonNullable(packageFolder, 'Could not find package folder.');
    dprintJsonPath = resolvePathFromRootSafe(join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.DprintJson), packageFolder);
  }

  if (!existsSync(dprintJsonPath)) {
    throw new Error('dprint.json not found');
  }

  const command = rewrite ? 'fmt' : 'check';
  await execFromRoot(['npx', 'dprint', command, '--config', dprintJsonPath, '**/*']);
}

/**
 * Checks the source code formatting without modifying files.
 *
 * @returns A {@link Promise} that resolves when the formatting check is complete.
 */
export async function formatCheck(): Promise<void> {
  await format(false);
}
