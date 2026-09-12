/**
 * @file
 *
 * Contains utility functions for error handling.
 */

import { AsyncEvents } from './async-events.ts';
import {
  CallbackDisposable,
  MultipleDisposeBehavior
} from './disposable.ts';
import { ensureNonNullable } from './type-guards.ts';

interface ErrorAsyncEventMap {
  asyncError: [error: unknown];
}

const errorAsyncEvents = new AsyncEvents<ErrorAsyncEventMap>();
// eslint-disable-next-line unicorn/no-top-level-side-effects -- Installing the default handler on import is what this module is for. Deferring it behind a call would mean every consumer had to remember to make that call before the first async error, which is precisely the moment the handler needs to already exist.
errorAsyncEvents.on('asyncError', handleAsyncError);

interface ModuleState {
  /**
   * The nesting depth of active {@link startAsyncErrorIgnoreContext} scopes. While greater than `0`, an
   * async error emitted (or a fire-and-forget operation whose rejection was captured) within the scope is
   * treated as expected and not collected as unhandled.
   */
  asyncErrorIgnoreContextDepth: number;

  /**
   * The buffer that collects unhandled async errors while a collection window is open, or `null` when
   * no window is open (the default in production). Opened by {@link startCollectingUnhandledAsyncErrors},
   * emptied without closing by {@link drainCollectedUnhandledAsyncErrors}, and drained-and-closed by
   * {@link stopCollectingUnhandledAsyncErrors} — used by the test harness to fail a test that swallowed
   * an async error.
   */
  collectedUnhandledAsyncErrors: null | unknown[];
}

/**
Module-level mutable state, held in one object so each mutation names it explicitly.
 */
const moduleState: ModuleState = {
  asyncErrorIgnoreContextDepth: 0,
  collectedUnhandledAsyncErrors: null
};
/**
 * A message of the AsyncWrapperError.
 */
export const ASYNC_WRAPPER_ERROR_MESSAGE = 'An unhandled error occurred executing async operation';

const STACK_TRACE_PREFIX = '    at';

/**
 * Parameters for the {@link CustomStackTraceError} constructor.
 */
export interface CustomStackTraceErrorConstructorParams {
  /**
   * The cause of the error.
   */
  readonly cause: unknown;

  /**
   * The message of the error.
   */
  readonly message: string;

  /**
   * The stack trace of the error.
   */
  readonly stackTrace: string;
}

/**
 * An error that wraps an error with a custom stack trace.
 */
export class CustomStackTraceError extends Error {
  /**
   * Creates a new CustomStackTraceError.
   *
   * @param params - The parameters for the error.
   */
  public constructor(params: CustomStackTraceErrorConstructorParams) {
    const { cause, message, stackTrace } = params;
    super(message, { cause });
    this.name = 'CustomStackTraceError';

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
      stackLines.shift();
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
  }
}

/**
 * Empties the collection window opened by {@link startCollectingUnhandledAsyncErrors} and returns what it
 * held, leaving the window **open** so errors emitted afterwards keep being collected.
 *
 * This is what {@link setup!setup}'s `beforeEach` / `afterEach` use, rather than
 * {@link stopCollectingUnhandledAsyncErrors}: an async error emitted in the gap between two tests (e.g. by a
 * `setTimeout` the test left pending) would otherwise land on a closed window and vanish unreported.
 *
 * @returns The unhandled async errors collected so far, or an empty array if no window is open.
 */
export function drainCollectedUnhandledAsyncErrors(): unknown[] {
  return moduleState.collectedUnhandledAsyncErrors?.splice(0) ?? [];
}

/**
 * Emits an asynchronous error event.
 *
 * When a collection window is open (see {@link startCollectingUnhandledAsyncErrors}) the error is
 * collected as unhandled unless it is ignored — either because `shouldIgnore` is `true` or an
 * {@link startAsyncErrorIgnoreContext} scope is active. A registered consumer handler deliberately does
 * **not** exempt the error: in production it shows the user a Notice, which is not a test asserting that
 * the error was expected. {@link startAsyncErrorIgnoreContext} is the single, explicit opt-out.
 *
 * @param asyncError - The error to emit as an asynchronous error event.
 * @param shouldIgnore - Whether to treat the error as expected and never collect it as unhandled, regardless of the active ignore context. Used to carry the schedule-time ignore decision of a deferred fire-and-forget rejection.
 */
export function emitAsyncErrorEvent(asyncError: unknown, shouldIgnore = false): void {
  const isIgnored = shouldIgnore || moduleState.asyncErrorIgnoreContextDepth > 0;
  if (moduleState.collectedUnhandledAsyncErrors && !isIgnored) {
    moduleState.collectedUnhandledAsyncErrors.push(asyncError);
  }
  errorAsyncEvents.trigger('asyncError', asyncError);
}

/**
 * Converts an error to a string representation, including nested causes and the aggregated errors of
 * an `AggregateError`, with indentation.
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
    message = appendNestedError(message, error.cause, 'Caused by:');
  }
  if (error instanceof AggregateError) {
    const aggregatedErrors: readonly unknown[] = error.errors;
    for (const [index, aggregatedError] of aggregatedErrors.entries()) {
      message = appendNestedError(message, aggregatedError, `Aggregated error #${String(index + 1)}:`);
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
 * Checks whether an {@link startAsyncErrorIgnoreContext} scope is currently active.
 *
 * @returns `true` if at least one ignore context is active, `false` otherwise.
 */
export function isAsyncErrorIgnoreContextActive(): boolean {
  return moduleState.asyncErrorIgnoreContextDepth > 0;
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
 * Registering a handler does not mark the errors it receives as expected — see
 * {@link emitAsyncErrorEvent}. A test that deliberately triggers an async error opens a
 * {@link startAsyncErrorIgnoreContext} scope regardless of who is listening.
 *
 * @param handler - The handler function to be called when an asynchronous error event occurs.
 * @returns A {@link Disposable} that unregisters the handler when disposed, for use with `using`.
 */
export function registerAsyncErrorEventHandler(handler: (asyncError: unknown) => void): Disposable {
  const eventRef = errorAsyncEvents.on('asyncError', handler);
  return new CallbackDisposable({
    callback: (): void => {
      errorAsyncEvents.offref(eventRef);
    },
    multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
  });
}

/**
 * Opens an ignore context in which async errors are treated as expected rather than unhandled, so the
 * test harness does not fail the test.
 *
 * While the returned disposable is held, an async error emitted directly (see
 * {@link emitAsyncErrorEvent}) is not collected as unhandled. Crucially, a fire-and-forget operation
 * scheduled within the scope (e.g. via {@link async!invokeAsyncSafely}) is also ignored when it later
 * rejects — even after the scope has exited — because {@link async!addErrorHandler} captures the active
 * ignore context at schedule time. A test therefore does not need to drain the operation itself:
 *
 * ```ts
 * it('does not fail', () => {
 *   using _ = startAsyncErrorIgnoreContext();
 *   invokeAsyncSafely(() => Promise.reject(new Error('deliberately swallowed')));
 * });
 * ```
 *
 * Contexts nest; the ignore only ends once every open context has been disposed.
 *
 * @returns A {@link Disposable} that closes the ignore context when disposed, for use with `using`.
 */
export function startAsyncErrorIgnoreContext(): Disposable {
  moduleState.asyncErrorIgnoreContextDepth++;
  return new CallbackDisposable({
    callback: (): void => {
      moduleState.asyncErrorIgnoreContextDepth--;
    },
    multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
  });
}

/**
 * Opens a window in which async errors emitted outside an ignore context are collected as unhandled
 * (see {@link emitAsyncErrorEvent}), discarding anything collected by a previous window.
 *
 * Intended for the test harness only: the per-test setup opens a window before each test and empties it
 * after each test via {@link drainCollectedUnhandledAsyncErrors}, closing it for good with
 * {@link stopCollectingUnhandledAsyncErrors} once the file's last test has run. In production no window
 * is open, so emitting an async error carries no bookkeeping overhead.
 */
export function startCollectingUnhandledAsyncErrors(): void {
  moduleState.collectedUnhandledAsyncErrors = [];
}

/**
 * Closes the window opened by {@link startCollectingUnhandledAsyncErrors} and returns the unhandled
 * async errors collected while it was open.
 *
 * Use {@link drainCollectedUnhandledAsyncErrors} instead wherever collection must continue afterwards —
 * once the window is closed, a later async error is not collected by anyone.
 *
 * @returns The collected unhandled async errors, or an empty array if no window was open.
 */
export function stopCollectingUnhandledAsyncErrors(): unknown[] {
  const collectedErrors = moduleState.collectedUnhandledAsyncErrors ?? [];
  moduleState.collectedUnhandledAsyncErrors = null;
  return collectedErrors;
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

function appendNestedError(message: string, nestedError: unknown, title: string): string {
  let result = `${message}\n${generateStackTraceLine(title)}`;
  for (const line of errorToString(nestedError).split('\n')) {
    if (!line.trim()) {
      continue;
    }
    result += line.startsWith(STACK_TRACE_PREFIX)
      ? `\n${line}`
      : `\n${generateStackTraceLine(line)}`;
  }
  return result;
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
