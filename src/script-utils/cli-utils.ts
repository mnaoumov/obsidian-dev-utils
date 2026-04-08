/**
 * @file
 *
 * Contains utility classes and functions for managing task results, including
 * success, exit codes, and chaining multiple tasks.
 */

import type { Promisable } from 'type-fest';

import process from 'node:process';

import type { MaybeReturn } from '../type.ts';

import { enableLibraryDebuggers } from '../debug.ts';
import { printError } from '../error.ts';
import { noop } from '../function.ts';
import { replaceAll } from '../string.ts';

/**
 * Abstract class representing the result of a task. Includes methods for handling success,
 * exit codes, and chaining tasks.
 */
export abstract class CliTaskResult {
  /**
   * Chains multiple tasks together, executing them sequentially until one fails.
   *
   * @param tasks - An array of task functions that return a {@link CliTaskResult} or `void`.
   * @returns A {@link Promise} that resolves with the first failed {@link CliTaskResult} or a success result.
   */
  public static async chain(tasks: (() => Promisable<MaybeReturn<CliTaskResult>>)[]): Promise<CliTaskResult> {
    for (const task of tasks) {
      const result = await wrapResult(task);
      if (!result.isSuccessful()) {
        return result;
      }
    }

    return CliTaskResult.Success();
  }

  /**
   * Creates a {@link CliTaskResult} that does not exit the process.
   *
   * @returns A {@link CliTaskResult} that does not exit the process.
   */
  public static DoNotExit(): CliTaskResult {
    return new DoNotExitTaskResult();
  }

  /**
   * A failure result of a CLI task.
   *
   * @returns The failure result.
   */
  public static Failure(): CliTaskResult {
    return this.Success(false);
  }

  /**
   * Creates a {@link CliTaskResult} based on an exit code.
   *
   * @param exitCode - The exit code to represent.
   * @returns A {@link CliTaskResult} representing the exit code.
   */
  public static FromExitCode(exitCode: number): CliTaskResult {
    return new ExitCodeTaskResult(exitCode);
  }

  /**
   * Creates a CliTaskResult representing a successful task result.
   *
   * @param isSuccess - A boolean indicating whether the task was successful. Default is `true`.
   * @returns A CliTaskResult object representing a successful task result.
   */
  public static Success(isSuccess = true): CliTaskResult {
    return new SuccessTaskResult(isSuccess);
  }

  /**
   * Exits the process based on the task result.
   */
  public abstract exit(): void;

  /**
   * Throws an error if the task was not successful.
   */
  public throwOnFailure(): void {
    if (!this.isSuccessful()) {
      throw new Error('Task failed');
    }
  }

  /**
   * Determines if the task was successful.
   *
   * @returns `true` if the task was successful, otherwise `false`.
   */
  protected abstract isSuccessful(): boolean;
}

/**
 * A task result that does not exit the process.
 */
class DoNotExitTaskResult extends CliTaskResult {
  /**
   * Does not exit the process.
   */
  public override exit(): void {
    noop();
  }

  protected override isSuccessful(): boolean {
    return true;
  }
}

/**
 * A task result based on an exit code.
 */
class ExitCodeTaskResult extends CliTaskResult {
  public constructor(private readonly exitCode: number) {
    super();
  }

  /**
   * Exits the process with the specified exit code.
   */
  public override exit(): void {
    process.exit(this.exitCode);
  }

  protected override isSuccessful(): boolean {
    return this.exitCode === 0;
  }
}

/**
 * A task result based on success or failure.
 */
class SuccessTaskResult extends CliTaskResult {
  public constructor(private readonly _isSuccessful: boolean) {
    super();
  }

  /**
   * Exits the process based on the success of the task.
   */
  public override exit(): void {
    process.exit(this._isSuccessful ? 0 : 1);
  }

  protected override isSuccessful(): boolean {
    return this._isSuccessful;
  }
}

/**
 * Converts an array of command-line arguments into a single command-line string
 * using the `CommandLineToArgvW` convention (the standard used by the
 * Microsoft C runtime and most Windows programs).
 *
 * Implements the ArgvQuote algorithm from
 * {@link https://learn.microsoft.com/archive/blogs/twistylittlepassagesallalike/everyone-quotes-command-line-arguments-the-wrong-way | Everyone quotes command line arguments the wrong way}:
 * backslashes before quotes and at the end of a quoted argument are doubled.
 *
 * This produces a shell-agnostic command line. Callers that route through
 * a specific shell (cmd.exe, PowerShell, sh) must apply shell-specific
 * escaping on top — see {@link cmdEscapeCommandLine}.
 *
 * @param args - The array of command-line arguments to convert.
 * @returns A string representing the command-line invocation.
 */
export function toCommandLine(args: string[]): string {
  return args.map((arg) => argvQuote(arg)).join(' ');
}

/**
 * Quotes a single argument so that `CommandLineToArgvW` will decode it
 * unchanged. Implements the ArgvQuote algorithm from
 * {@link https://learn.microsoft.com/archive/blogs/twistylittlepassagesallalike/everyone-quotes-command-line-arguments-the-wrong-way | Everyone quotes command line arguments the wrong way}.
 *
 * @param arg - The raw argument string.
 * @returns The quoted argument string.
 */
function argvQuote(arg: string): string {
  if (arg.length > 0 && !/[\s\t\n\v"]/.test(arg)) {
    return arg;
  }

  const BACKSLASH_ESCAPE_FACTOR = 2;
  let result = '"';
  for (let i = 0; i < arg.length; i++) {
    let numBackslashes = 0;
    while (i < arg.length && arg[i] === '\\') {
      i++;
      numBackslashes++;
    }

    if (i === arg.length) {
      result += '\\'.repeat(numBackslashes * BACKSLASH_ESCAPE_FACTOR);
      break;
    }

    const ch = arg.charAt(i);
    if (ch === '"') {
      result += `${'\\'.repeat(numBackslashes * BACKSLASH_ESCAPE_FACTOR + 1)}"`;
    } else {
      result += '\\'.repeat(numBackslashes) + ch;
    }
  }

  result += '"';
  return result;
}

/**
 * Matches `cmd.exe` metacharacters that must be `^`-escaped.
 */
const CMD_META_RE = /[()%!^"<>&|]/g;

/**
 * Escapes `cmd.exe` metacharacters with `^` so that `cmd.exe` passes them
 * through literally. This is necessary because `cmd.exe`'s `"` handling
 * differs from `CommandLineToArgvW` and cannot be relied upon.
 *
 * Apply this to a command line string that will be executed via `cmd.exe`
 * (e.g., `spawn(cmd, [], { shell: true })` on Windows).
 *
 * @param commandLine - The already-quoted command line string.
 * @returns The string with all cmd metacharacters `^`-escaped.
 */
export function cmdEscapeCommandLine(commandLine: string): string {
  return replaceAll(commandLine, CMD_META_RE, '^$&');
}

/**
 * Wraps a CLI task function to ensure it runs safely and handles its {@link CliTaskResult}.
 *
 * @param taskFn - The task function to execute, which may return a {@link CliTaskResult} or `void`.
 * @returns A {@link Promise} that resolves when the task is completed and exits with the appropriate status.
 */
export async function wrapCliTask(taskFn: () => Promisable<MaybeReturn<CliTaskResult>>): Promise<void> {
  enableLibraryDebuggers();
  const result = await wrapResult(taskFn);
  result.exit();
}

/**
 * Safely executes a task function and returns a {@link CliTaskResult}. If the task function throws an error,
 * An error is caught, and a failure {@link CliTaskResult} is returned.
 *
 * @param taskFn - The task function to execute.
 * @returns A {@link Promise} that resolves with a {@link CliTaskResult} representing the outcome of the task.
 */
async function wrapResult(taskFn: () => Promisable<MaybeReturn<CliTaskResult>>): Promise<CliTaskResult> {
  try {
    return (await taskFn()) as CliTaskResult | undefined ?? CliTaskResult.Success();
  } catch (error) {
    printError(new Error('An error occurred during task execution', { cause: error }));
    return CliTaskResult.Failure();
  }
}
