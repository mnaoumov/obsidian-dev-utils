/**
 * @packageDocumentation Debug
 * Contains utility functions for debugging.
 */

import type { Debugger } from 'debug';

import debug from 'debug';

import type { DebugController } from './DebugController.ts';

interface DebuggerEx extends Debugger {
  printStackTrace(stackTrace: string, title?: string): void;
}

interface DebugWrapper {
  DEBUG: DebugController;
}

let currentPluginId = '';
const NAMESPACE_SEPARATOR = ',';
const NEGATED_NAMESPACE_PREFIX = '-';

/**
 * Enables the specified namespaces.
 *
 * @param namespaces - The namespaces to enable.
 */
export function enableNamespaces(namespaces: string | string[]): void {
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

/**
 * Returns a debugger instance with a log function that includes the caller's file name and line number.
 *
 * @param namespace - The namespace for the debugger instance.
 * @param framesToSkip - The number of frames to skip in the stack trace.
 * @returns A debugger instance with a log function that includes the caller's file name and line number.
 */
export function getDebugger(namespace: string, framesToSkip = 0): DebuggerEx {
  const debugInstance = debug(namespace) as DebuggerEx;
  debugInstance.log = (message: string, ...args: unknown[]): void => {
    logWithCaller(namespace, framesToSkip, message, ...args);
  };
  debugInstance.printStackTrace = (stackTrace, title): void => {
    printStackTrace(namespace, stackTrace, title);
  };
  return debugInstance;
}

/**
 * Returns a debugger instance for the `obsidian-dev-utils` library.
 *
 * @param namespace - The namespace for the debugger instance.
 * @returns A debugger instance for the `obsidian-dev-utils` library.
 */
export function getLibDebugger(namespace: string): DebuggerEx {
  const prefix = currentPluginId ? `${currentPluginId}:` : '';
  return getDebugger(`${prefix}obsidian-dev-utils:${namespace}`);
}

/**
 * Adds the DEBUG variable to the window object.
 *
 * @param pluginId - The plugin ID.
 */
export function initDebugHelpers(pluginId: string): void {
  currentPluginId = pluginId;
  (window as Partial<DebugWrapper>).DEBUG = {
    disable: disableNamespaces,
    enable: enableNamespaces,
    get: getNamespaces,
    set: setNamespaces
  };

  const isEnabled = debug.enabled(pluginId);
  const state = isEnabled ? 'enabled' : 'disabled';
  const changeAction = isEnabled ? 'disable' : 'enable';
  const namespaces = getNamespaces();
  setNamespaces(pluginId);
  getDebugger(pluginId)(`Debug messages for plugin ${pluginId} are ${state}. See https://github.com/mnaoumov/obsidian-dev-utils/?tab=readme-ov-file#debugging how to ${changeAction} them.`);
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

function getNamespaces(): string[] {
  return toArray(debug.load() ?? '');
}

function isInObsidian(): boolean {
  return typeof window !== 'undefined';
}

function logWithCaller(namespace: string, framesToSkip: number, message: string, ...args: unknown[]): void {
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
  const callerLine = stackLines[CALLER_LINE_INDEX + framesToSkip] ?? '';
  console.debug(message, ...args);
  if (isInObsidian()) {
    printStackTrace(namespace, callerLine, 'Debug message caller');
  }
}

function printStackTrace(namespace: string, stackTrace: string, title?: string): void {
  const _debugger = debug(namespace);

  if (!_debugger.enabled) {
    return;
  }

  if (!stackTrace) {
    stackTrace = '(unavailable)';
  }
  if (!title) {
    title = 'Caller stack trace';
  }

  _debugger(title);
  const prefix = isInObsidian() ? 'StackTraceFakeError\n' : '';
  console.debug(`${prefix}${stackTrace}`);
}

function setNamespaces(namespaces: string | string[]): void {
  debug.enable(toArray(namespaces).join(NAMESPACE_SEPARATOR));
}

function toArray(namespaces: string | string[]): string[] {
  return typeof namespaces === 'string' ? namespaces.split(NAMESPACE_SEPARATOR).filter(Boolean) : namespaces.flatMap(toArray);
}
