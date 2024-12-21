/**
 * @packageDocumentation Debug
 * Contains utilities for debugging.
 */

interface DebugWindow {
  DEBUG: boolean;
}

/**
 * Returns true if the window.DEBUG is set.
 *
 * @returns True if the window.DEBUG is set.
 */
export function isDebug(): boolean {
  return (globalThis as Partial<DebugWindow>).DEBUG ?? false;
}
