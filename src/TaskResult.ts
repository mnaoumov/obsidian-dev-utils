/**
 * @fileoverview Contains utility classes and functions for managing task results, including
 * success, exit codes, and chaining multiple tasks.
 */

import process from "node:process";
import type { MaybePromise } from "./Async.ts";

/**
 * Abstract class representing the result of a task. Includes methods for handling success,
 * exit codes, and chaining tasks.
 */
export abstract class TaskResult {
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
  public static async chain(tasks: (() => MaybePromise<TaskResult | void>)[]): Promise<TaskResult> {
    for (const task of tasks) {
      const result = await getTaskResult(task);
      if (!result.isSuccessful()) {
        return result;
      }
    }

    return TaskResult.CreateSuccessResult(true);
  }

  /**
   * Determines if the task was successful.
   *
   * @returns `true` if the task was successful, otherwise `false`.
   */
  protected abstract isSuccessful(): boolean;

  /**
   * Creates a `TaskResult` representing a success or failure.
   *
   * @param isSuccess - Indicates whether the task was successful.
   * @returns A `TaskResult` representing the success or failure.
   */
  public static CreateSuccessResult(isSuccess: boolean): TaskResult {
    return new SuccessTaskResult(isSuccess);
  }

  /**
   * Creates a `TaskResult` based on an exit code.
   *
   * @param exitCode - The exit code to represent.
   * @returns A `TaskResult` representing the exit code.
   */
  public static CreateExitCodeResult(exitCode: number): TaskResult {
    return new ExitCodeTaskResult(exitCode);
  }

  /**
   * Creates a `TaskResult` that does not exit the process.
   *
   * @returns A `TaskResult` that does not exit the process.
   */
  public static DoNotExit(): TaskResult {
    return new DoNotExitTaskResult();
  }
}

/**
 * Represents a task result based on success or failure.
 */
class SuccessTaskResult extends TaskResult {
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
class ExitCodeTaskResult extends TaskResult {
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
class DoNotExitTaskResult extends TaskResult {
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
export async function getTaskResult(taskFn: () => MaybePromise<TaskResult | void>): Promise<TaskResult> {
  try {
    return await taskFn() ?? TaskResult.CreateSuccessResult(true);
  } catch (error) {
    console.error(error);
    return TaskResult.CreateSuccessResult(false);
  }
}
