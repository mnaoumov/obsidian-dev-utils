/** @packageDocumentation format
 * Format the source code.
 */

import {
  getDirname,
  join
} from '../Path.ts';
import { existsSync } from './NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from './ObsidianDevUtilsRepoPaths.ts';
import {
  execFromRoot,
  getRootDir,
  resolvePathFromRootSafe
} from './Root.ts';

/**
 * Format the source code.
 *
 * @param rewrite - Whether to rewrite the source code.
 * @returns A promise that resolves when the source code has been formatted.
 */
export async function format(rewrite = true): Promise<void> {
  const rootDir = getRootDir();
  if (!rootDir) {
    throw new Error('Root directory not found');
  }
  let dprintJsonPath = resolvePathFromRootSafe(ObsidianDevUtilsRepoPaths.DprintJson);
  if (!existsSync(dprintJsonPath)) {
    const packageDir = getRootDir(getDirname(import.meta.url));
    if (!packageDir) {
      throw new Error('Could not find package directory.');
    }
    dprintJsonPath = resolvePathFromRootSafe(join(ObsidianDevUtilsRepoPaths.Dist, ObsidianDevUtilsRepoPaths.DprintJson), packageDir);
  }

  if (!existsSync(dprintJsonPath)) {
    throw new Error('dprint.json not found');
  }

  const command = rewrite ? 'fmt' : 'check';
  await execFromRoot(['npx', 'dprint', command, '--config', dprintJsonPath, '**/*']);
}
