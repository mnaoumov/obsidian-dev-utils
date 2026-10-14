/**
 * @file
 *
 * Formats an Obsidian plugin with dprint: the generic runner from `@mnaoumov/typescript-dev-toolkit`, falling
 * back to this package's `dprint.json` template when the project has none.
 */

import type { FormatOptions } from '@mnaoumov/typescript-dev-toolkit/formatters/dprint';

import { format as formatGeneric } from '@mnaoumov/typescript-dev-toolkit/formatters/dprint';
import { RepoPaths } from '@mnaoumov/typescript-dev-toolkit/repo-paths';

import { getTemplateFilePath } from '../templates.ts';

/**
 * Formats the source code.
 *
 * @param options - The {@link FormatOptions}.
 */
export async function format(options?: FormatOptions): Promise<void> {
  await formatGeneric({ defaultConfigFilePath: getTemplateFilePath(RepoPaths.DprintJson), ...options });
}
export { type FormatOptions } from '@mnaoumov/typescript-dev-toolkit/formatters/dprint';
