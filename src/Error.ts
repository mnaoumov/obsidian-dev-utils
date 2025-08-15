/**
 * @packageDocumentation
 *
 * Contains utility functions for error handling.
 */

import { AsyncEvents } from './AsyncEvents.ts';

const ASYNC_ERROR_EVENT = 'asyncError';

const ERROR_STACK_PREFIX = 'Error stack:\n';

const asyncErrorEventEmitter = new AsyncEvents();
asyncErrorEventEmitter.on(ASYNC_ERROR_EVENT, handleAsyncError);

interface ErrorEntry {
  level: number;
  message: string;
  shouldClearAnsiSequence?: boolean;
}

/**
 * The message of the AsyncWrapperError.
 */
export const ASYNC_WRAPPER_ERROR_MESSAGE = 'An unhandled error occurred executing async operation';

/**
 * An error that wraps an error with a custom stack trace.
 */
export class CustomStackTraceError extends Error {
  /**
   * Creates a new CustomStackTraceError.
   *
   * @param message - The message of the error.
   * @param stackTrace - The stack trace of the error.
   * @param cause - The cause of the error.
   */
  public constructor(message: string, stackTrace: string, cause: unknown) {
    super(message, { cause });
    this.name = 'CustomStackTraceError';
    Error.captureStackTrace(this, CustomStackTraceError);

    let rootCause = cause;
    const parentCauses = new Set<CustomStackTraceError>();
    while (rootCause instanceof CustomStackTraceError) {
      if (parentCauses.has(rootCause)) {
        throw new Error('Circular cause detected');
      }
      parentCauses.add(rootCause);
      rootCause = rootCause.cause;
    }

    const originalStackLines = (this.stack ?? '').split('\n');
    const stackLines = stackTrace.split('\n');
    const ERROR_HEADER_REG_EXP = /^\w*Error(?:: |$)/;
    if (ERROR_HEADER_REG_EXP.test(stackLines[0] ?? '')) {
      stackLines.splice(0, 1);
    }
    originalStackLines.splice(1, originalStackLines.length - 1, ...stackLines);
    this.stack = originalStackLines.join('\n');
  }
}

/**
 * Emits an asynchronous error event.
 *
 * @param asyncError - The error to emit as an asynchronous error event.
 */
export function emitAsyncErrorEvent(asyncError: unknown): void {
  asyncErrorEventEmitter.trigger(ASYNC_ERROR_EVENT, asyncError);
}

/**
 * Converts an error to a string representation, including nested causes with indentation.
 *
 * @param error - The error to convert to a string.
 * @returns The string representation of the error.
 */
export function errorToString(error: unknown): string {
  return parseErrorEntries(error)
    .map((entry) => '  '.repeat(entry.level) + (entry.message.startsWith(ERROR_STACK_PREFIX) ? entry.message.slice(ERROR_STACK_PREFIX.length) : entry.message))
    .join('\n');
}

/**
 * Gets the current stack trace as a string, excluding the current function call.
 *
 * @param framesToSkip - The number of frames to skip in the stack trace.
 * @returns A string representation of the current stack trace, excluding the current function call.
 */
export function getStackTrace(framesToSkip = 0): string {
  // Skipping Error prefix and `getStackTrace` function call
  const ADDITIONAL_FRAMES_TO_SKIP = 2;
  const stack = new Error().stack ?? '';
  const lines = stack.split('\n');
  return lines.slice(framesToSkip + ADDITIONAL_FRAMES_TO_SKIP).join('\n');
}

/**
 * Prints an error to the console, including nested causes and optional ANSI sequence clearing.
 *
 * @param error - The error to print.
 * @param console - The console to print to (default: `globalThis.console`).
 */
export function printError(error: unknown, console?: Console): void {
  console ??= globalThis.console;
  const entries = parseErrorEntries(error);

  for (const entry of entries) {
    if (entry.shouldClearAnsiSequence) {
      console.error(`\x1b[0m${entry.message}\x1b[0m`);
    } else {
      console.error(entry.message);
    }
  }
}

/**
 * Registers an event handler for asynchronous errors.
 *
 * @param handler - The handler function to be called when an asynchronous error event occurs.
 * @returns A function to unregister the handler.
 */
export function registerAsyncErrorEventHandler(handler: (asyncError: unknown) => void): () => void {
  const eventRef = asyncErrorEventEmitter.on(ASYNC_ERROR_EVENT, handler);
  return () => {
    asyncErrorEventEmitter.offref(eventRef);
  };
}

/**
 * Throws an error with the specified message.
 *
 * @param error - The error to throw.
 * @throws
 */
export function throwExpression(error: unknown): never {
  throw error;
}

/**
 * Handles asynchronous errors by printing them.
 *
 * @param asyncError - The asynchronous error to handle.
 */
function handleAsyncError(asyncError: unknown): void {
  printError(asyncError);
}

/**
 * Parses an error into an array of ErrorEntry objects, including nested causes.
 *
 * @param error - The error to parse.
 * @param level - The current indentation level for nested causes.
 * @param entries - The array of ErrorEntry objects to populate.
 * @returns An array of ErrorEntry objects representing the error and its causes.
 */
function parseErrorEntries(error: unknown, level = 0, entries: ErrorEntry[] = []): ErrorEntry[] {
  if (error === undefined) {
    return entries;
  }

  if (!(error instanceof Error)) {
    let str: string;

    if (error === null) {
      str = '(null)';
    } else if (typeof error === 'string') {
      str = error;
    } else {
      str = JSON.stringify(error) ?? 'undefined';
    }

    entries.push({ level, message: str });
    return entries;
  }

  const title = `${error.name}: ${error.message}`;
  entries.push({ level, message: title, shouldClearAnsiSequence: true });

  if (error.stack) {
    const restStack = error.stack.startsWith(title) ? error.stack.slice(title.length + 1) : error.stack;
    entries.push({ level, message: `${ERROR_STACK_PREFIX}${restStack}` });
  }

  if (error.cause !== undefined) {
    entries.push({ level, message: 'Caused by:' });
    parseErrorEntries(error.cause, level + 1, entries);
  }

  return entries;
}
