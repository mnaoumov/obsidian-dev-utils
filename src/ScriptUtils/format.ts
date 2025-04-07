/**
 * @packageDocumentation
 *
 * Format the source code.
 */

import {
  getFolderName,
  join
} from '../Path.ts';
import { existsSync } from './NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from './ObsidianDevUtilsRepoPaths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from './Root.ts';

/**
 * Format the source code.
 *
 * @param rewrite - Whether to rewrite the source code.
 * @returns A {@link Promise} that resolves when the source code has been formatted.
 */
export async function format(rewrite = true): Promise<void> {
  const rootFolder = getRootFolder();
  if (!rootFolder) {
    throw new Error('Root folder not found');
  }
  let dprintJsonPath = resolvePathFromRootSafe(ObsidianDevUtilsRepoPaths.DprintJson);
  if (!existsSync(dprintJsonPath)) {
    const packageFolder = getRootFolder(getFolderName(import.meta.url));
    if (!packageFolder) {
      throw new Error('Could not find package folder.');
    }
    dprintJsonPath = resolvePathFromRootSafe(join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.DprintJson), packageFolder);
  }

  if (!existsSync(dprintJsonPath)) {
    throw new Error('dprint.json not found');
  }

  const command = rewrite ? 'fmt' : 'check';
  await execFromRoot(['npx', 'dprint', command, '--config', dprintJsonPath, '**/*']);
}
