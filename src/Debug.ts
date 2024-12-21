/**
 * @packageDocumentation Debug
 * Contains utilities for debugging.
 */

interface DebugWindow {
  DEBUG: boolean;
}

export function isDebug(): boolean {
  return (globalThis as Partial<DebugWindow>).DEBUG ?? false;
}
