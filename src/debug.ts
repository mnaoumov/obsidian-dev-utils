/**
 * @packageDocumentation
 *
 * Contains utility functions for debugging.
 */

import type { Debugger } from 'debug';

import debug from 'debug';

import type { DebugController } from './debug-controller.ts';

import { CustomStackTraceError } from './error.ts';
import { LIBRARY_NAME } from './library.ts';
import { getObsidianDevUtilsState } from './obsidian/app.ts';
import {
  getPluginId,
  NO_PLUGIN_ID_INITIALIZED
} from './obsidian/plugin/plugin-id.ts';

const NAMESPACE_SEPARATOR = ',';
const NEGATED_NAMESPACE_PREFIX = '-';

/**
 * Enables the debuggers for the `obsidian-dev-utils` library.
 */
export function enableLibraryDebuggers(): void {
  enableNamespaces([LIBRARY_NAME, `${LIBRARY_NAME}:*`]);
}

/**
 * Returns a debug controller.
 *
 * @returns A debug controller.
 */
export function getDebugController(): DebugController {
  return {
    disable: disableNamespaces,
    enable: enableNamespaces,
    get: getNamespaces,
    set: setNamespaces
  };
}

/**
 * Returns a debugger instance with a log function that includes the caller's file name and line number.
 *
 * @param namespace - The namespace for the debugger instance.
 * @param framesToSkip - The number of frames to skip in the stack trace.
 * @returns A debugger instance with a log function that includes the caller's file name and line number.
 */
export function getDebugger(namespace: string, framesToSkip = 0): Debugger {
  const key = `${namespace}:${String(framesToSkip)}`;
  const debuggersMap = getObsidianDevUtilsState(null, 'debuggers', new Map<string, Debugger>()).value;
  let debuggerEx = debuggersMap.get(key);
  if (!debuggerEx) {
    debuggerEx = getSharedDebugLibInstance()(namespace);
    debuggerEx.log = (message: string, ...args: unknown[]): void => {
      logWithCaller(namespace, framesToSkip, message, ...args);
    };

    debuggersMap.set(key, debuggerEx);
  }

  return debuggerEx;
}

/**
 * Returns a debugger instance for the `obsidian-dev-utils` library.
 *
 * @param namespace - The namespace for the debugger instance.
 * @returns A debugger instance for the `obsidian-dev-utils` library.
 */
export function getLibDebugger(namespace: string): Debugger {
  const pluginId = getPluginId();
  const prefix = pluginId === NO_PLUGIN_ID_INITIALIZED ? '' : `${pluginId}:`;
  return getDebugger(`${prefix}${LIBRARY_NAME}:${namespace}`);
}

/**
 * Prints a message with a stack trace.
 *
 * @param debuggerInstance - The debugger instance.
 * @param stackTrace - The stack trace to print.
 * @param message - The message to print.
 * @param args - The arguments to print.
 */
export function printWithStackTrace(debuggerInstance: Debugger, stackTrace: string, message: string, ...args: unknown[]): void {
  /* v8 ignore start -- Only the true branch is taken in Node tests (window is undefined). */
  if (!isInObsidian()) {
    /* v8 ignore stop */
    debuggerInstance(message, ...args);
    return;
  }

  /* v8 ignore start -- Only reachable in Obsidian (window defined). */
  debuggerInstance(message, ...args, '\n\n---\nContext stack trace:\n', makeStackTraceError(stackTrace));
  /* v8 ignore stop */
}

/**
 * Shows an initial debug message.
 *
 * @param pluginId - The plugin ID.
 */
export function showInitialDebugMessage(pluginId: string): void {
  const isEnabled = getSharedDebugLibInstance().enabled(pluginId);
  const state = isEnabled ? 'enabled' : 'disabled';
  const changeAction = isEnabled ? 'disable' : 'enable';
  const namespaces = getNamespaces();
  setNamespaces(pluginId);
  getDebugger(pluginId)(
    `Debug messages for plugin ${pluginId} are ${state}. See https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md how to ${changeAction} them.`
  );
  setNamespaces(namespaces);
}

function disableNamespaces(namespaces: string | string[]): void {
  const set = new Set(getNamespaces());
  for (const namespace of toArray(namespaces)) {
    if (namespace.startsWith(NEGATED_NAMESPACE_PREFIX)) {
      continue;
    }
    const negatedNamespace = NEGATED_NAMESPACE_PREFIX + namespace;
    if (set.has(namespace)) {
      set.delete(namespace);
    }
    set.add(negatedNamespace);
  }
  setNamespaces(Array.from(set));
}

function enableNamespaces(namespaces: string | string[]): void {
  const set = new Set(getNamespaces());
  for (const namespace of toArray(namespaces)) {
    if (!namespace.startsWith(NEGATED_NAMESPACE_PREFIX)) {
      const negatedNamespace = NEGATED_NAMESPACE_PREFIX + namespace;
      if (set.has(negatedNamespace)) {
        set.delete(negatedNamespace);
      }
    }
    set.add(namespace);
  }
  setNamespaces(Array.from(set));
}

function getNamespaces(): string[] {
  return toArray(getSharedDebugLibInstance().load() ?? '');
}

function getSharedDebugLibInstance(): typeof debug {
  /* v8 ignore start -- In Node tests, window is always undefined. */
  if (typeof window === 'undefined') {
    /* v8 ignore stop */
    return debug;
  }
  /* v8 ignore start -- Only reachable in Obsidian (window defined). */
  return getObsidianDevUtilsState(null, 'debug', debug).value;
  /* v8 ignore stop */
}

function isInObsidian(): boolean {
  return typeof window !== 'undefined';
}

function logWithCaller(namespace: string, framesToSkip: number, message: string, ...args: unknown[]): void {
  if (!getSharedDebugLibInstance().enabled(namespace)) {
    return;
  }

  /* v8 ignore start -- Only the true branch is taken in Node tests (window is undefined). */
  if (!isInObsidian()) {
    /* v8 ignore stop */
    console.debug(message, ...args);
    return;
  }

  /* v8 ignore start -- Only reachable in Obsidian (window defined). */
  /**
   * A caller line index is 4 because the call stack is as follows:
   *
   * 0: Error
   * 1:     at logWithCaller (?:?:?)
   * 2:     at debugInstance.log (?:?:?)
   * 3:     at debug (?:?:?)
   * 4:     at functionName (path/to/caller.js:?:?)
   */
  const CALLER_LINE_INDEX = 4;

  const stackLines = new Error().stack?.split('\n') ?? [];
  stackLines.splice(0, CALLER_LINE_INDEX + framesToSkip);

  console.debug(message, ...args, '\n\n---\nLogger stack trace:\n', makeStackTraceError(stackLines.join('\n')));
  /* v8 ignore stop */
}

/* v8 ignore start -- Only used in Obsidian context. */
function makeStackTraceError(stackTrace: string): CustomStackTraceError {
  return new CustomStackTraceError(
    'Debug mode: intentional placeholder error. See https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md.',
    stackTrace,
    undefined
  );
}
/* v8 ignore stop */

/**
 * Sets the namespaces to enable.
 *
 * @param namespaces - The namespaces to enable.
 */
function setNamespaces(namespaces: string | string[]): void {
  getSharedDebugLibInstance().enable(toArray(namespaces).join(NAMESPACE_SEPARATOR));
}

function toArray(namespaces: string | string[]): string[] {
  return typeof namespaces === 'string' ? namespaces.split(NAMESPACE_SEPARATOR).filter(Boolean) : namespaces.flatMap(toArray);
}
