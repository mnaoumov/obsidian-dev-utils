/**
 * @packageDocumentation
 *
 * Check if the source code is formatted.
 */

import { format } from '../format.ts';

/**
 * Checks if the source code is formatted.
 *
 * @returns A {@link Promise} that resolves when the check is complete.
 */
export async function formatCheck(): Promise<void> {
  await format(false);
}
