/**
 * @packageDocumentation Debug
 * Contains utility functions for debugging.
 */

import debug from 'debug';

/**
 * Returns a debugger instance with a log function that includes the caller's file name and line number.
 *
 * @param id - The namespace for the debugger instance.
 * @returns A debugger instance with a log function that includes the caller's file name and line number.
 */
export function getDebugger(id: string): debug.Debugger {
  const debugInstance = getDebugger(id);
  debugInstance.log = logWithCaller;
  return debugInstance;
}

function logWithCaller(message: string, ...args: unknown[]): void {
  const stack = new Error().stack?.split('\n')[2];
  const caller = stack?.trim().replace(/^at /, '') ?? '';
  console.debug(message, ...args, `[${caller}]`);
}
