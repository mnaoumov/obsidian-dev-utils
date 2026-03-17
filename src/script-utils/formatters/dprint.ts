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
 * Parameters for the {@link format} function.
 */
export interface FormatParams {
  /**
   * Optional file paths to format. If omitted, formats the entire project.
   */
  paths?: string[] | undefined;

  /**
   * Whether to rewrite the source code.
   */
  rewrite?: boolean | undefined;
}

/**
 * Format the source code.
 *
 * @param params - The {@link FormatParams}.
 * @returns A {@link Promise} that resolves when the source code has been formatted.
 */
export async function format(params?: FormatParams): Promise<void> {
  const { paths, rewrite = true } = params ?? {};
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
  /* v8 ignore start -- The paths-provided branch is only exercised by consumer projects passing file lists. */
  const targets = paths?.length ? paths : ['**/*'];
  /* v8 ignore stop */
  await execFromRoot(['npx', 'dprint', command, '--config', dprintJsonPath, { batchedArgs: targets }]);
}
