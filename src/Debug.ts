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
  const debugInstance = debug.default(id);
  debugInstance.log = logWithCaller;
  return debugInstance;
}

function logWithCaller(message: string, ...args: unknown[]): void {
  /**
   * The caller line index is 3 because the call stack is as follows:
   *
   * 0: Error
   * 1:     at Function.logWithCaller [as log] (?:?:?)
   * 2:     at debug (plugin:?:?:?)
   * 3:     at functionName (path/to/caller.js:?:?)
   */
  const CALLER_LINE_INDEX = 3;

  const stackLines = new Error().stack?.split('\n') ?? [];
  const callerLine = stackLines[CALLER_LINE_INDEX] ?? '';
  console.debug(message, ...args);
  if (callerLine) {
    console.debug(`DebugMessageStackError\n${callerLine}`);
  }
}
