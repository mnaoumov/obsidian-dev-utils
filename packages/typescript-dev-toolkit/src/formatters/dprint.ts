/**
 * @file
 *
 * Format the source code.
 */

import { assertNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { existsSync } from 'node:fs';

import { resolveToolCommand } from '../package-manager.ts';
import { RepoPaths } from '../repo-paths.ts';
import {
  execFromRoot,
  getRootFolder,
  resolvePathFromRootSafe
} from '../root.ts';

/**
 * Parameters for the {@link format} function.
 */
export interface FormatOptions {
  /**
   * The `dprint.json` used when the project has none of its own. Without it, a project with no `dprint.json`
   * fails.
   */
  readonly defaultConfigFilePath?: string | undefined;

  /**
   * Optional file paths to format. If omitted, formats the entire project.
   */
  readonly paths?: string[] | undefined;

  /**
   * Whether to rewrite the source code.
   *
   * @default `true`
   */
  readonly rewrite?: boolean | undefined;
}

/**
 * Format the source code.
 *
 * @param options - The {@link FormatOptions}.
 * @returns A {@link Promise} that resolves when the source code has been formatted.
 */
export async function format(options?: FormatOptions): Promise<void> {
  const { defaultConfigFilePath, paths, rewrite = true } = options ?? {};
  const rootFolder = getRootFolder();
  assertNonNullable(rootFolder, 'Root folder not found');
  let dprintJsonPath = resolvePathFromRootSafe({ path: RepoPaths.DprintJson });
  if (!existsSync(dprintJsonPath) && defaultConfigFilePath) {
    dprintJsonPath = defaultConfigFilePath;
  }

  if (!existsSync(dprintJsonPath)) {
    throw new Error('dprint.json not found');
  }

  const command = rewrite ? 'fmt' : 'check';
  /* v8 ignore start -- The paths-provided branch is only exercised by consumer projects passing file lists. */
  const targets = paths?.length ? paths : ['**/*'];
  /* v8 ignore stop */
  await execFromRoot([...resolveToolCommand({ tool: 'dprint' }), command, '--config', dprintJsonPath, { batchedArguments: targets }]);
}
