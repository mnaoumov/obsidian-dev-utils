/**
 * @packageDocumentation Debug
 * Contains utility functions for debugging.
 */

import type { Debugger } from 'debug';

import debug from 'debug';

interface DebuggerEx extends Debugger {
  printStackTrace: (stackTrace: string, title?: string) => void;
}

/**
 * Returns a debugger instance with a log function that includes the caller's file name and line number.
 *
 * @param id - The namespace for the debugger instance.
 * @returns A debugger instance with a log function that includes the caller's file name and line number.
 */
export function getDebugger(id: string): DebuggerEx {
  const debugInstance = debug.default(id) as DebuggerEx;
  debugInstance.log = (message: string, ...args: unknown[]): void => {
    logWithCaller(id, message, ...args);
  };
  debugInstance.printStackTrace = (stackTrace, title): void => {
    printStackTrace(id, stackTrace, title);
  };
  return debugInstance;
}

function logWithCaller(id: string, message: string, ...args: unknown[]): void {
  if (!debug.enabled(id)) {
    return;
  }

  /**
   * The caller line index is 4 because the call stack is as follows:
   *
   * 0: Error
   * 1:     at logWithCaller (?:?:?)
   * 2:     at debugInstance.log (?:?:?)
   * 3:     at debug (?:?:?)
   * 4:     at functionName (path/to/caller.js:?:?)
   */
  const CALLER_LINE_INDEX = 4;

  const stackLines = new Error().stack?.split('\n') ?? [];
  const callerLine = stackLines[CALLER_LINE_INDEX] ?? '';
  console.debug(message, ...args);
  printStackTrace(id, callerLine, 'Original debug message caller');
}

function printStackTrace(id: string, stackTrace: string, title?: string): void {
  if (!debug.enabled(id)) {
    return;
  }

  if (!stackTrace) {
    stackTrace = '(unavailable)';
  }
  if (!title) {
    title = 'Caller stack trace';
  }
  console.debug(`NotError:${id}:${title}\n${stackTrace}`);
}
