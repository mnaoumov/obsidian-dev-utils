/**
 * @packageDocumentation cli
 * Contains utility classes and functions for managing task results, including
 * success, exit codes, and chaining multiple tasks.
 */

import process from "node:process";
import type { MaybePromise } from "../Async.ts";
import { printError } from "../Error.ts";

/**
 * Abstract class representing the result of a task. Includes methods for handling success,
 * exit codes, and chaining tasks.
 */
export abstract class CliTaskResult {
  /**
   * Exits the process based on the task result.
   */
  public abstract exit(): void;

  /**
   * Chains multiple tasks together, executing them sequentially until one fails.
   *
   * @param tasks - An array of task functions that return a `TaskResult` or `void`.
   * @returns A promise that resolves with the first failed `TaskResult` or a success result.
   */
  public static async chain(tasks: (() => MaybePromise<CliTaskResult | void>)[]): Promise<CliTaskResult> {
    for (const task of tasks) {
      const result = await wrapResult(task);
      if (!result.isSuccessful()) {
        return result;
      }
    }

    return CliTaskResult.Success();
  }

  /**
   * Determines if the task was successful.
   *
   * @returns `true` if the task was successful, otherwise `false`.
   */
  protected abstract isSuccessful(): boolean;

  /**
   * Creates a CliTaskResult representing a successful task result.
   *
   * @param isSuccess - A boolean indicating whether the task was successful. Default is true.
   * @returns A CliTaskResult object representing a successful task result.
   */
  public static Success(isSuccess: boolean = true): CliTaskResult {
    return new SuccessTaskResult(isSuccess);
  }

  /**
   * Represents a failure result of a CLI task.
   *
   * @returns The failure result.
   */
  public static Failure(): CliTaskResult {
    return this.Success(false);
  }

  /**
   * Creates a `TaskResult` based on an exit code.
   *
   * @param exitCode - The exit code to represent.
   * @returns A `TaskResult` representing the exit code.
   */
  public static FromExitCode(exitCode: number): CliTaskResult {
    return new ExitCodeTaskResult(exitCode);
  }

  /**
   * Creates a `TaskResult` that does not exit the process.
   *
   * @returns A `TaskResult` that does not exit the process.
   */
  public static DoNotExit(): CliTaskResult {
    return new DoNotExitTaskResult();
  }
}

/**
 * Represents a task result based on success or failure.
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
 * Represents a task result based on an exit code.
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
 * Represents a task result that does not exit the process.
 */
class DoNotExitTaskResult extends CliTaskResult {
  public constructor() {
    super();
  }

  /**
   * Does not exit the process.
   */
  public override exit(): void {
  }

  protected override isSuccessful(): boolean {
    return true;
  }
}

/**
 * Safely executes a task function and returns a `TaskResult`. If the task function throws an error,
 * the error is caught, and a failure `TaskResult` is returned.
 *
 * @param taskFn - The task function to execute.
 * @returns A promise that resolves with a `TaskResult` representing the outcome of the task.
 */
async function wrapResult(taskFn: () => MaybePromise<CliTaskResult | void>): Promise<CliTaskResult> {
  try {
    return await taskFn() ?? CliTaskResult.Success();
  } catch (error) {
    printError(new Error("An error occurred during task execution", { cause: error }));
    return CliTaskResult.Failure();
  }
}

/**
 * Wraps a CLI task function to ensure it runs safely and handles its `TaskResult`.
 *
 * @param taskFn - The task function to execute, which may return a `TaskResult` or void.
 * @returns A promise that resolves when the task is completed and exits with the appropriate status.
 */
export async function wrapCliTask(taskFn: () => MaybePromise<CliTaskResult | void>): Promise<void> {
  const result = await wrapResult(taskFn);
  result.exit();
}

/**
 * Converts an array of command-line arguments into a single command-line string.
 * Handles escaping of special characters such as spaces, quotes, and newlines.
 *
 * @param args - The array of command-line arguments to convert.
 * @returns A string representing the command-line invocation.
 */
export function toCommandLine(args: string[]): string {
  return args
    .map((arg) => {
      if (/[\s"\n]/.test(arg)) {
        const escapedArg = arg.replace(/"/g, "\\\"").replace(/\n/g, "\\n");
        return `"${escapedArg}"`;
      }
      return arg;
    })
    .join(" ");
}
