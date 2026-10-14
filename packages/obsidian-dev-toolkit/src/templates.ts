/**
 * @file
 *
 * Locates the consumer-facing templates this package ships in `dist/templates`.
 */

import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';
import { getRootFolder } from '@mnaoumov/typescript-dev-toolkit/root';
import {
  getFolderName,
  join
} from '@mnaoumov/typescript-lib/path';
import { assertNonNullable } from '@mnaoumov/typescript-lib/type-guards';

/**
 * Returns the absolute path of a template this package ships.
 *
 * @param name - The template's file name within `dist/templates`, e.g. `eslint.config.mts`.
 * @returns The absolute path.
 */
export function getTemplateFilePath(name: string): string {
  const packageFolder = getRootFolder(getFolderName(import.meta.url));
  assertNonNullable(packageFolder, 'Package folder not found');
  return join(packageFolder, RepoPaths.DistTemplates, name);
}
