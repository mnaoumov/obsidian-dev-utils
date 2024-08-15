import process from "node:process";
import type { MaybePromise } from "./Async.ts";

export abstract class TaskResult {
  public abstract exit(): void;

  public static async chain(tasks: (() => MaybePromise<TaskResult | void>)[]): Promise<TaskResult> {
    for (const task of tasks) {
      const result = await getTaskResult(task, []);
      if (!result.isSuccessful()) {
        return result;
      }
    }

    return TaskResult.CreateSuccessResult(true);
  }

  protected abstract isSuccessful(): boolean;

  public static CreateSuccessResult(isSuccess: boolean): TaskResult {
    return new SuccessTaskResult(isSuccess);
  }

  public static CreateExitCodeResult(exitCode: number): TaskResult {
    return new ExitCodeTaskResult(exitCode);
  }

  public static DoNotExit(): TaskResult {
    return new DoNotExitTaskResult();
  }
}

class SuccessTaskResult extends TaskResult {
  constructor(private readonly _isSuccessful: boolean) {
    super();
  }

  public override exit(): void {
    process.exit(this._isSuccessful ? 0 : 1);
  }

  protected override isSuccessful(): boolean {
    return this._isSuccessful;
  }
}

class ExitCodeTaskResult extends TaskResult {
  constructor(private readonly exitCode: number) {
    super();
  }

  public override exit(): void {
    process.exit(this.exitCode);
  }

  protected override isSuccessful(): boolean {
    return this.exitCode === 0;
  }
}

class DoNotExitTaskResult extends TaskResult {
  constructor() {
    super();
  }

  public override exit(): void {
  }

  protected override isSuccessful(): boolean {
    return true;
  }
}

export async function getTaskResult<TaskArgs extends unknown[]>(taskFn: (...taskArgs: TaskArgs) => MaybePromise<TaskResult | void>, taskArgs: TaskArgs): Promise<TaskResult> {
  try {
    return await taskFn(...taskArgs) ?? TaskResult.CreateSuccessResult(true)
  }
  catch (error) {
    console.error(error);
    return TaskResult.CreateSuccessResult(false);
  }
}
