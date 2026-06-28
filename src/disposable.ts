/**
 * @file
 *
 * Disposable utilities for `using` / `await using` declarations.
 */

import type { Promisable } from 'type-fest';

import { assertNever } from './type-guards.ts';

/**
 * Determines how a {@link CallbackDisposable} or {@link AsyncCallbackDisposable} behaves when it is
 * disposed more than once.
 */
export enum MultipleDisposeBehavior {
  /**
   * Invoke the callback on every dispose.
   */
  Invoke,

  /**
   * Invoke the callback on the first dispose only; subsequent disposes are no-ops.
   */
  Ignore,

  /**
   * Invoke the callback on the first dispose only; subsequent disposes throw.
   */
  Throw
}

/**
 * The parameters for constructing an {@link AsyncCallbackDisposable}.
 */
export interface AsyncCallbackDisposableConstructorParams {
  /**
   * The callback to execute when disposed.
   */
  readonly callback: AsyncDisposeCallback;

  /**
   * How the disposable behaves when disposed more than once.
   *
   * @default {@link MultipleDisposeBehavior.Invoke}
   */
  readonly multipleDisposeBehavior?: MultipleDisposeBehavior;
}

/**
 * A callback invoked when an {@link AsyncCallbackDisposable} is disposed.
 */
export type AsyncDisposeCallback = (this: void) => Promisable<void>;

/**
 * The parameters for constructing a {@link CallbackDisposable}.
 */
export interface CallbackDisposableConstructorParams {
  /**
   * The callback to execute when disposed.
   */
  readonly callback: DisposeCallback;

  /**
   * How the disposable behaves when disposed more than once.
   *
   * @default {@link MultipleDisposeBehavior.Invoke}
   */
  readonly multipleDisposeBehavior?: MultipleDisposeBehavior;
}

/**
 * A callback invoked when a {@link CallbackDisposable} is disposed.
 */
export type DisposeCallback = (this: void) => void;

/**
 * An async disposable that executes a callback when disposed via `await using` (or a manual
 * `await disposable[Symbol.asyncDispose]()`).
 */
export class AsyncCallbackDisposable implements AsyncDisposable {
  private readonly callback: AsyncDisposeCallback;
  private isDisposed = false;
  private readonly multipleDisposeBehavior: MultipleDisposeBehavior;

  /**
   * Creates a new instance of {@link AsyncCallbackDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: AsyncCallbackDisposableConstructorParams) {
    this.callback = params.callback;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Invoke;
  }

  /**
   * Disposes the object by executing the callback.
   *
   * This method is called automatically when the object is used in an `await using` declaration. It
   * can also be called manually. The behavior on a second and later dispose is controlled by
   * {@link AsyncCallbackDisposableConstructorParams.multipleDisposeBehavior}.
   *
   * @returns A {@link Promise} that resolves once the callback completes.
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    if (this.isDisposed) {
      switch (this.multipleDisposeBehavior) {
        case MultipleDisposeBehavior.Ignore:
          return;
        case MultipleDisposeBehavior.Invoke:
          break;
        case MultipleDisposeBehavior.Throw:
          throw new Error('This AsyncCallbackDisposable has already been disposed.');
        default:
          assertNever(this.multipleDisposeBehavior);
      }
    }

    this.isDisposed = true;
    await this.callback();
  }
}

/**
 * A disposable that executes a callback when disposed.
 */
export class CallbackDisposable implements Disposable {
  private readonly callback: DisposeCallback;
  private isDisposed = false;
  private readonly multipleDisposeBehavior: MultipleDisposeBehavior;

  /**
   * Creates a new instance of {@link CallbackDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: CallbackDisposableConstructorParams) {
    this.callback = params.callback;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Invoke;
  }

  /**
   * Disposes the object by executing the callback.
   *
   * This method is called automatically when the object is used in a `using` declaration. It can also
   * be called manually. The behavior on a second and later dispose is controlled by
   * {@link CallbackDisposableConstructorParams.multipleDisposeBehavior}.
   */
  public [Symbol.dispose](): void {
    if (this.isDisposed) {
      switch (this.multipleDisposeBehavior) {
        case MultipleDisposeBehavior.Ignore:
          return;
        case MultipleDisposeBehavior.Invoke:
          break;
        case MultipleDisposeBehavior.Throw:
          throw new Error('This CallbackDisposable has already been disposed.');
        default:
          assertNever(this.multipleDisposeBehavior);
      }
    }

    this.isDisposed = true;
    this.callback();
  }
}

/**
 * Type guard to check if an object implements the {@link AsyncDisposable} interface.
 *
 * @param obj - the object to check for the {@link AsyncDisposable} interface
 * @returns Whether the object implements the {@link AsyncDisposable} interface
 */
export function isAsyncDisposable(obj: unknown): obj is AsyncDisposable {
  const asyncDisposable = obj as Partial<AsyncDisposable>;
  return !!asyncDisposable[Symbol.asyncDispose];
}

/**
 * Type guard to check if an object implements the {@link Disposable} interface.
 *
 * @param obj - the object to check for the {@link Disposable} interface
 * @returns Whether the object implements the {@link Disposable} interface
 */
export function isDisposable(obj: unknown): obj is Disposable {
  const disposable = obj as Partial<Disposable>;
  return !!disposable[Symbol.dispose];
}
