/** @packageDocumentation format
 * Format the source code.
 */

import { execFromRoot } from './Root.ts';

/**
 * Format the source code.
 *
 * @returns A promise that resolves when the source code has been formatted.
 */
export async function format(): Promise<void> {
  await execFromRoot('dprint fmt **/*');
}
