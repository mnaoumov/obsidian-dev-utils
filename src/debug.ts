/**
 * @file
 *
 * Contains utility functions for debugging.
 */

import type { Debugger } from 'debug';

import debug from 'debug';

import type { DebugController } from './debug-controller.ts';

import {
  CustomStackTraceError,
  getStackTrace
} from './error.ts';
import {
  Library,
  LIBRARY_NAME
} from './library.ts';
import { getObsidianDevUtilsState } from './obsidian-dev-utils-state.ts';

const NAMESPACE_SEPARATOR = ',';
const NEGATED_NAMESPACE_PREFIX = '-';

/**
 * Parameters for {@link printWithStackTrace}.
 */
export interface PrintWithStackTraceParams {
  /**
   * The arguments to print.
   */
  readonly $arguments: unknown[];

  /**
   * The debugger instance.
   */
  readonly debuggerInstance: Debugger;

  /**
   * The message to print.
   */
  readonly message: string;

  /**
   * The stack trace to print.
   */
  readonly stackTrace: string;
}

/**
 * Parameters for {@link logWithCaller}.
 */
interface LogWithCallerParams {
  /**
   * The arguments to print.
   */
  readonly $arguments: unknown[];

  /**
   * The number of frames to skip in the stack trace.
   */
  readonly framesToSkip: number;

  /**
   * The message to print.
   */
  readonly message: string;

  /**
   * The namespace for the debugger instance.
   */
  readonly namespace: string;
}

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
  const debuggersMap = getObsidianDevUtilsState('debuggers', new Map<string, Debugger>()).value;
  let debuggerEx = debuggersMap.get(key);
  if (!debuggerEx) {
    debuggerEx = getSharedDebugLibInstance()(namespace);
    debuggerEx.log = (message: string, ...$arguments: unknown[]): void => {
      logWithCaller({
        $arguments,
        framesToSkip,
        message,
        namespace
      });
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
  return getDebugger(`${Library.debugPrefixNamespace}${LIBRARY_NAME}:${namespace}`);
}

/**
 * Prints a message with a stack trace.
 *
 * @param params - The parameters for printing the message.
 */
export function printWithStackTrace(params: PrintWithStackTraceParams): void {
  const {
    $arguments,
    debuggerInstance,
    message,
    stackTrace
  } = params;
  if (!Library.shouldPrintStackTrace) {
    debuggerInstance(message, ...$arguments);
    return;
  }

  debuggerInstance(message, ...$arguments, '\n\n---\nContext stack trace:\n', makeStackTraceError(stackTrace));
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
    `Debug messages for plugin ${pluginId} are ${state}. See https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/ how to ${changeAction} them.`
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
    set.delete(namespace);
    set.add(negatedNamespace);
  }
  setNamespaces([...set]);
}

function enableNamespaces(namespaces: string | string[]): void {
  const set = new Set(getNamespaces());
  for (const namespace of toArray(namespaces)) {
    if (!namespace.startsWith(NEGATED_NAMESPACE_PREFIX)) {
      const negatedNamespace = NEGATED_NAMESPACE_PREFIX + namespace;
      set.delete(negatedNamespace);
    }
    set.add(namespace);
  }
  setNamespaces([...set]);
}

function getNamespaces(): string[] {
  return toArray(getSharedDebugLibInstance().load() ?? '');
}

function getSharedDebugLibInstance(): typeof debug {
  return getObsidianDevUtilsState('debug', debug).value;
}

function logWithCaller(params: LogWithCallerParams): void {
  const {
    $arguments,
    framesToSkip,
    message,
    namespace
  } = params;
  if (!getSharedDebugLibInstance().enabled(namespace)) {
    return;
  }

  if (!Library.shouldPrintStackTrace) {
    // eslint-disable-next-line no-console -- Valid usage.
    console.debug(message, ...$arguments);
    return;
  }

  /**
   * The caller is 3 frames above this one, because the call stack is as follows:
   *
   * 0: logWithCaller
   * 1: debugInstance.log
   * 2: debug
   * 3: functionName (the caller)
   *
   * `getStackTrace` drops its own frame and, on an engine that writes one, the `Error` header line.
   */
  const CALLER_FRAME_INDEX = 3;

  // eslint-disable-next-line no-console -- Valid usage.
  console.debug(message, ...$arguments, '\n\n---\nLogger stack trace:\n', makeStackTraceError(getStackTrace(CALLER_FRAME_INDEX + framesToSkip)));
}

function makeStackTraceError(stackTrace: string): CustomStackTraceError {
  return new CustomStackTraceError({
    cause: undefined,
    message: 'Debug mode: intentional placeholder error. See https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/.',
    stackTrace
  });
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
  return typeof namespaces === 'string' ? namespaces.split(NAMESPACE_SEPARATOR).filter(Boolean) : namespaces.flatMap((namespace) => toArray(namespace));
}
