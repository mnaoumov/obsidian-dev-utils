/**
 * @packageDocumentation Error
 * Contains utility functions for error handling.
 */

import { EventEmitter } from "node:events";

const ASYNC_ERROR_EVENT = "asyncError";

const asyncErrorEventEmitter = new EventEmitter();
asyncErrorEventEmitter.on(ASYNC_ERROR_EVENT, handleAsyncError);

/**
 * Handles asynchronous errors by printing them.
 *
 * @param asyncError - The asynchronous error to handle.
 */
function handleAsyncError(asyncError: unknown): void {
  printError(new Error("An unhandled error occurred executing async operation", { cause: asyncError }));
}

/**
 * Emits an asynchronous error event.
 *
 * @param asyncError - The error to emit as an asynchronous error event.
 */
export function emitAsyncErrorEvent(asyncError: unknown): void {
  asyncErrorEventEmitter.emit(ASYNC_ERROR_EVENT, asyncError);
}

/**
 * Registers an event handler for asynchronous errors.
 *
 * @param handler - The handler function to be called when an asynchronous error event occurs.
 * @returns A function to unregister the handler.
 */
export function registerAsyncErrorEventHandler(handler: (asyncError: unknown) => void): () => void {
  asyncErrorEventEmitter.on(ASYNC_ERROR_EVENT, handler);
  return () => asyncErrorEventEmitter.off(ASYNC_ERROR_EVENT, handler);
}

type ErrorEntry = {
  level: number;
  message: string;
  shouldClearAnsiSequence?: boolean;
}

/**
 * Prints an error to the console, including nested causes and optional ANSI sequence clearing.
 *
 * @param error - The error to print.
 */
export function printError(error: unknown): void {
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
 * Converts an error to a string representation, including nested causes with indentation.
 *
 * @param error - The error to convert to a string.
 * @returns The string representation of the error.
 */
export function errorToString(error: unknown): string {
  return parseErrorEntries(error).map((entry) => "  ".repeat(entry.level) + entry.message).join("\n");
}

/**
 * Parses an error into an array of ErrorEntry objects, including nested causes.
 *
 * @param error - The error to parse.
 * @param level - The current indentation level for nested causes.
 * @param entries - The array of ErrorEntry objects to populate.
 * @returns An array of ErrorEntry objects representing the error and its causes.
 */
function parseErrorEntries(error: unknown, level: number = 0, entries: ErrorEntry[] = []): ErrorEntry[] {
  if (error === undefined) {
    return entries;
  }

  if (!(error instanceof Error)) {
    let str = "";

    if (error === null) {
      str = "(null)";
    } else if (typeof error === "string") {
      str = error;
    } else {
      str = JSON.stringify(error);
    }

    entries.push({ level, message: str });
    return entries;
  }

  const title = `${error.name}: ${error.message}`;
  entries.push({ level, message: title, shouldClearAnsiSequence: true });

  if (error.stack) {
    const restStack = error.stack.startsWith(title) ? error.stack.substring(title.length + 1) : error.stack;
    entries.push({ level, message: `Error stack:\n${restStack}` });
  }

  if (error.cause !== undefined) {
    entries.push({ level, message: "Caused by:" });
    parseErrorEntries(error.cause, level + 1, entries);
  }

  return entries;
}
