/**
 * @packageDocumentation
 *
 * Contains utility functions for debugging.
 */

import type { Debugger } from 'debug';

import debug from 'debug';

import type { DebugController } from './DebugController.ts';

import { LIBRARY_NAME } from './Library.ts';
import { getObsidianDevUtilsState } from './obsidian/App.ts';
import {
  getPluginId,
  NO_PLUGIN_ID_INITIALIZED
} from './obsidian/Plugin/PluginId.ts';

interface DebuggerEx extends Debugger {
  printStackTrace(stackTrace: string, title?: string): void;
}

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
export function getDebugger(namespace: string, framesToSkip = 0): DebuggerEx {
  const key = `${namespace}:${framesToSkip.toString()}`;
  const debuggersMap = getObsidianDevUtilsState(null, 'debuggers', new Map<string, DebuggerEx>()).value;
  let _debugger = debuggersMap.get(key);
  if (!_debugger) {
    _debugger = getSharedDebugLibInstance()(namespace) as DebuggerEx;
    _debugger.log = (message: string, ...args: unknown[]): void => {
      logWithCaller(namespace, framesToSkip, message, ...args);
    };
    _debugger.printStackTrace = (stackTrace, title): void => {
      printStackTrace(namespace, stackTrace, title);
    };

    debuggersMap.set(key, _debugger);
  }

  return _debugger;
}

/**
 * Returns a debugger instance for the `obsidian-dev-utils` library.
 *
 * @param namespace - The namespace for the debugger instance.
 * @returns A debugger instance for the `obsidian-dev-utils` library.
 */
export function getLibDebugger(namespace: string): DebuggerEx {
  const pluginId = getPluginId();
  const prefix = pluginId === NO_PLUGIN_ID_INITIALIZED ? '' : `${pluginId}:`;
  return getDebugger(`${prefix}${LIBRARY_NAME}:${namespace}`);
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
  if (typeof window === 'undefined') {
    return debug;
  }
  return getObsidianDevUtilsState(null, 'debug', debug).value;
}

function isInObsidian(): boolean {
  return typeof window !== 'undefined';
}

function logWithCaller(namespace: string, framesToSkip: number, message: string, ...args: unknown[]): void {
  if (!getSharedDebugLibInstance().enabled(namespace)) {
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
  // eslint-disable-next-line no-console
  console.debug(message, ...args);
  if (isInObsidian()) {
    printStackTrace(namespace, callerLine, 'Debug message caller');
  }
}

function printStackTrace(namespace: string, stackTrace: string, title?: string): void {
  const _debugger = getSharedDebugLibInstance()(namespace);

  if (!_debugger.enabled) {
    return;
  }

  if (!stackTrace) {
    stackTrace = '(unavailable)';
  }
  if (!(title ?? '')) {
    title = 'Caller stack trace';
  }

  _debugger(title);
  const prefix = isInObsidian() ? 'StackTraceFakeError\n' : '';
  // eslint-disable-next-line no-console
  console.debug(`${prefix}${stackTrace}`);
}

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
