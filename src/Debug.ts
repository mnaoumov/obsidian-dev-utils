/**
 * @packageDocumentation Debug
 * Contains utility functions for debugging.
 */

import type { Debugger } from 'debug';

import debug from 'debug';

interface DebuggerEx extends Debugger {
  printStackTrace: (stackTrace: string, title?: string) => void;
}

interface EnableDebuggersWrapper {
  enableDebuggers: typeof enableDebuggers;
}

/**
 * Enables the debuggers for the given namespaces.
 *
 * @param namespaces - The namespaces to enable.
 */
export function enableDebuggers(namespaces: string): void {
  debug.enable(namespaces);
}

/**
 * Returns a debugger instance with a log function that includes the caller's file name and line number.
 *
 * @param namespace - The namespace for the debugger instance.
 * @returns A debugger instance with a log function that includes the caller's file name and line number.
 */
export function getDebugger(namespace: string): DebuggerEx {
  const debugInstance = debug.default(namespace) as DebuggerEx;
  debugInstance.log = (message: string, ...args: unknown[]): void => {
    logWithCaller(namespace, message, ...args);
  };
  debugInstance.printStackTrace = (stackTrace, title): void => {
    printStackTrace(namespace, stackTrace, title);
  };
  return debugInstance;
}

/**
 * Sets the enableDebuggers function on the window object.
 */
export function setEnableDebuggers(): void {
  (window as Partial<EnableDebuggersWrapper>).enableDebuggers = enableDebuggers;
}

function logWithCaller(namespace: string, message: string, ...args: unknown[]): void {
  if (!debug.enabled(namespace)) {
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
  printStackTrace(namespace, callerLine, 'Original debug message caller');
}

function printStackTrace(namespace: string, stackTrace: string, title?: string): void {
  if (!debug.enabled(namespace)) {
    return;
  }

  if (!stackTrace) {
    stackTrace = '(unavailable)';
  }
  if (!title) {
    title = 'Caller stack trace';
  }
  console.debug(`NotError:${namespace}:${title}\n${stackTrace}`);
}
