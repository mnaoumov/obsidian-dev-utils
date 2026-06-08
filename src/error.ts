/**
 * @file
 *
 * Contains utility functions for error handling.
 */

import { AsyncEvents } from './async-events.ts';
import { ensureNonNullable } from './type-guards.ts';

interface ErrorAsyncEventMap {
  asyncError: [error: unknown];
}

const errorAsyncEvents = new AsyncEvents<ErrorAsyncEventMap>();
errorAsyncEvents.on('asyncError', handleAsyncError);

/**
 * A message of the AsyncWrapperError.
 */
export const ASYNC_WRAPPER_ERROR_MESSAGE = 'An unhandled error occurred executing async operation';

const STACK_TRACE_PREFIX = '    at';

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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `?.` is used to support iOS before 17.2.
    Error.captureStackTrace?.(this, CustomStackTraceError);

    let rootCause = cause;
    const parentCauses = new Set<CustomStackTraceError>();
    while (rootCause instanceof CustomStackTraceError) {
      if (parentCauses.has(rootCause)) {
        throw new Error('Circular cause detected');
      }
      parentCauses.add(rootCause);
      rootCause = rootCause.cause;
    }

    const originalStackLines = ensureNonNullable(this.stack).split('\n');
    const stackLines = stackTrace.split('\n');
    const ERROR_HEADER_REG_EXP = /^\w*Error(?:: |$)/;
    if (ERROR_HEADER_REG_EXP.test(ensureNonNullable(stackLines[0]))) {
      stackLines.splice(0, 1);
    }
    originalStackLines.splice(1, originalStackLines.length - 1, ...stackLines);
    this.stack = originalStackLines.join('\n');
  }
}

/**
 * An error that wraps a non-`Error` value that was thrown, preserving the original value in `cause`.
 */
export class ErrorWrapper extends Error {
  /**
   * Creates a new ErrorWrapper.
   *
   * @param thrownValue - The original non-`Error` value that was thrown.
   */
  public constructor(thrownValue: unknown) {
    super(`A non-Error value was thrown: ${String(thrownValue)}`, { cause: thrownValue });
    this.name = 'ErrorWrapper';

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `?.` is used to support iOS before 17.2.
    Error.captureStackTrace?.(this, ErrorWrapper);
  }

  /**
   * Normalizes any thrown value to an `Error`.
   *
   * Returns the value unchanged if it is already an `Error`, otherwise wraps it in an {@link ErrorWrapper}.
   *
   * @param thrownValue - The thrown value to normalize.
   * @returns An `Error` instance: the original value if it is already an `Error`, otherwise an {@link ErrorWrapper}.
   */
  public static create(thrownValue: unknown): Error {
    return thrownValue instanceof Error ? thrownValue : new ErrorWrapper(thrownValue);
  }
}

/**
 * An error that is not printed to the console.
 */
export class SilentError extends Error {
  /**
   * Creates a new SilentError.
   *
   * @param message - The message of the error.
   */
  public constructor(message: string) {
    super(message);
    this.name = 'SilentError';

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `?.` is used to support iOS before 17.2.
    Error.captureStackTrace?.(this, SilentError);
  }
}

/**
 * Emits an asynchronous error event.
 *
 * @param asyncError - The error to emit as an asynchronous error event.
 */
export function emitAsyncErrorEvent(asyncError: unknown): void {
  errorAsyncEvents.trigger('asyncError', asyncError);
}

/**
 * Converts an error to a string representation, including nested causes with indentation.
 *
 * @param error - The error to convert to a string.
 * @returns The string representation of the error.
 */
export function errorToString(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  let message = error.stack ?? `${error.name}: ${error.message}`;
  if (error.cause !== undefined) {
    const causeStrLines = errorToString(error.cause).split('\n');
    message += `\n${generateStackTraceLine('Caused by:')}`;
    for (const line of causeStrLines) {
      if (!line.trim()) {
        continue;
      }
      message += line.startsWith(STACK_TRACE_PREFIX)
        ? `\n${line}`
        : `\n${generateStackTraceLine(line)}`;
    }
  }
  return message;
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
  const stack = ensureNonNullable(new Error().stack);
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
  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  console ??= globalThis.console;
  console.error(errorToString(error));
}

/**
 * Registers an event handler for asynchronous errors.
 *
 * @param handler - The handler function to be called when an asynchronous error event occurs.
 * @returns A function to unregister the handler.
 */
export function registerAsyncErrorEventHandler(handler: (asyncError: unknown) => void): () => void {
  const eventRef = errorAsyncEvents.on('asyncError', handler);
  return () => {
    errorAsyncEvents.offref(eventRef);
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

function generateStackTraceLine(title: string): string {
  return `${STACK_TRACE_PREFIX} --- ${title} --- (0)`;
}

/**
 * Handles asynchronous errors by printing them.
 *
 * @param asyncError - The asynchronous error to handle.
 */
function handleAsyncError(asyncError: unknown): void {
  printError(asyncError);
}
