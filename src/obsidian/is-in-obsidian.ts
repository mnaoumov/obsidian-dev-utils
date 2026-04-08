/**
 * @file
 *
 * Checks whether the code is running inside an Obsidian environment.
 */

import {
  // eslint-disable-next-line import-x/no-deprecated -- We need to use the deprecated function to check for Obsidian.
  getApp
} from './app.ts';

/**
 * Checks whether the code is running inside an Obsidian environment.
 *
 * @returns Whether the code is running inside Obsidian.
 */
export function isInObsidian(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated, import-x/no-deprecated -- We need to use the deprecated function to check for Obsidian.
    getApp();
    return true;
  } catch {
    return false;
  }
}
