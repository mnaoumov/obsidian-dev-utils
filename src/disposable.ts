/**
 * @file
 *
 * Disposable utilities for `using` / `await using` declarations.
 */

import type { Promisable } from 'type-fest';

import { assertNever } from './type-guards.ts';

/**
 * Determines the error semantics of a {@link CombineDisposable} or {@link CombineAsyncDisposable} when
 * one of its children throws while being disposed.
 */
export enum DisposeErrorBehavior {
  /**
   * Dispose every child even if some of them throw, collecting the thrown errors and re-throwing them
   * as a single {@link AggregateError} once all children have been disposed.
   */
  Aggregate,

  /**
   * Re-throw the first error a child throws immediately, leaving the remaining children undisposed.
   */
  FailFast
}

/**
 * Determines the order in which a {@link CombineDisposable} or {@link CombineAsyncDisposable} disposes
 * its children.
 */
export enum DisposeOrder {
  /**
   * Dispose the last-registered child first (last-in, first-out), like nested `using` declarations
   * unwinding in reverse.
   */
  Lifo,

  /**
   * Dispose the first-registered child first (first-in, first-out).
   */
  Fifo
}

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
   * @default {@link MultipleDisposeBehavior.Ignore}
   */
  readonly multipleDisposeBehavior?: MultipleDisposeBehavior;
}

/**
 * An {@link AsyncDisposable} that additionally exposes a convenience {@link AsyncDisposableEx.asyncDispose}
 * method, so a stored handle can be disposed as `handle.asyncDispose()` instead of the clunkier
 * `handle[Symbol.asyncDispose]()`.
 */
export interface AsyncDisposableEx extends AsyncDisposable {
  /**
   * Disposes the object. Delegates to `this[Symbol.asyncDispose]()`.
   *
   * @returns A {@link Promise} that resolves once disposal completes.
   */
  asyncDispose(): Promise<void>;
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
   * @default {@link MultipleDisposeBehavior.Ignore}
   */
  readonly multipleDisposeBehavior?: MultipleDisposeBehavior;
}

/**
 * The parameters for constructing a {@link CombineAsyncDisposable}.
 */
export interface CombineAsyncDisposableConstructorParams {
  /**
   * The async disposables to dispose when the combiner is disposed.
   */
  readonly asyncDisposables: Iterable<AsyncDisposable>;

  /**
   * The order in which the children are disposed.
   *
   * @default {@link DisposeOrder.Lifo}
   */
  readonly disposeOrder?: DisposeOrder;

  /**
   * How the combiner behaves when one of its children throws while being disposed.
   *
   * @default {@link DisposeErrorBehavior.Aggregate}
   */
  readonly errorBehavior?: DisposeErrorBehavior;

  /**
   * How the combiner behaves when it is disposed more than once.
   *
   * @default {@link MultipleDisposeBehavior.Ignore}
   */
  readonly multipleDisposeBehavior?: MultipleDisposeBehavior;
}

/**
 * The parameters for constructing a {@link CombineDisposable}.
 */
export interface CombineDisposableConstructorParams {
  /**
   * The disposables to dispose when the combiner is disposed.
   */
  readonly disposables: Iterable<Disposable>;

  /**
   * The order in which the children are disposed.
   *
   * @default {@link DisposeOrder.Lifo}
   */
  readonly disposeOrder?: DisposeOrder;

  /**
   * How the combiner behaves when one of its children throws while being disposed.
   *
   * @default {@link DisposeErrorBehavior.Aggregate}
   */
  readonly errorBehavior?: DisposeErrorBehavior;

  /**
   * How the combiner behaves when it is disposed more than once.
   *
   * @default {@link MultipleDisposeBehavior.Ignore}
   */
  readonly multipleDisposeBehavior?: MultipleDisposeBehavior;
}

/**
 * A {@link Disposable} that additionally exposes a convenience {@link DisposableEx.dispose} method, so a
 * stored handle can be disposed as `handle.dispose()` instead of the clunkier `handle[Symbol.dispose]()`.
 */
export interface DisposableEx extends Disposable {
  /**
   * Disposes the object. Delegates to `this[Symbol.dispose]()`.
   */
  dispose(): void;
}

/**
 * A callback invoked when a {@link CallbackDisposable} is disposed.
 */
export type DisposeCallback = (this: void) => void;

/**
 * Abstract base for an {@link AsyncDisposableEx}: it carries the re-dispose guard (via
 * {@link MultipleDisposeBehavior}) and the {@link AsyncDisposableEx.asyncDispose} alias; a subclass only
 * implements {@link AsyncDisposableBase.performDisposeAsync}.
 */
export abstract class AsyncDisposableBase implements AsyncDisposableEx {
  /**
   * How the disposable behaves when disposed more than once.
   *
   * @default {@link MultipleDisposeBehavior.Ignore}
   */
  protected multipleDisposeBehavior: MultipleDisposeBehavior = MultipleDisposeBehavior.Ignore;

  /**
   * Whether this disposable has been disposed (its teardown has run at least once).
   *
   * @returns `true` once disposal has started.
   */
  protected get isDisposed(): boolean {
    return this._isDisposed;
  }

  private _isDisposed = false;

  /**
   * Disposes the object. Convenience alias that delegates to `this[Symbol.asyncDispose]()`.
   *
   * @returns A {@link Promise} that resolves once teardown completes.
   */
  public asyncDispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  /**
   * Disposes the object by running {@link AsyncDisposableBase.performDisposeAsync}, honoring the configured
   * {@link MultipleDisposeBehavior} on a repeat dispose.
   *
   * @returns A {@link Promise} that resolves once teardown completes.
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    if (!shouldPerformDispose(this._isDisposed, this.multipleDisposeBehavior)) {
      return;
    }

    this._isDisposed = true;
    await this.performDisposeAsync();
  }

  /**
   * Performs the actual teardown. Called at most once unless {@link MultipleDisposeBehavior.Invoke} is set.
   *
   * @returns A {@link Promisable} that resolves once teardown completes.
   */
  protected abstract performDisposeAsync(): Promisable<void>;
}

/**
 * An async disposable that executes a callback when disposed via `await using` (or a manual
 * `await disposable[Symbol.asyncDispose]()`).
 */
export class AsyncCallbackDisposable extends AsyncDisposableBase {
  private readonly callback: AsyncDisposeCallback;

  /**
   * Creates a new instance of {@link AsyncCallbackDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: AsyncCallbackDisposableConstructorParams) {
    super();
    this.callback = params.callback;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Ignore;
  }

  /**
   * Runs the dispose callback.
   *
   * @returns A {@link Promise} that resolves once the callback completes.
   */
  protected override async performDisposeAsync(): Promise<void> {
    await this.callback();
  }
}

/**
 * Abstract base for a {@link DisposableEx}: it carries the re-dispose guard (via {@link MultipleDisposeBehavior})
 * and the {@link DisposableEx.dispose} alias; a subclass only implements {@link DisposableBase.performDispose}.
 */
export abstract class DisposableBase implements DisposableEx {
  /**
   * How the disposable behaves when disposed more than once.
   *
   * @default {@link MultipleDisposeBehavior.Ignore}
   */
  protected multipleDisposeBehavior: MultipleDisposeBehavior = MultipleDisposeBehavior.Ignore;

  /**
   * Whether this disposable has been disposed (its teardown has run at least once).
   *
   * @returns `true` once disposal has started.
   */
  protected get isDisposed(): boolean {
    return this._isDisposed;
  }

  private _isDisposed = false;

  /**
   * Disposes the object. Convenience alias that delegates to `this[Symbol.dispose]()`.
   */
  public dispose(): void {
    this[Symbol.dispose]();
  }

  /**
   * Disposes the object by running {@link DisposableBase.performDispose}, honoring the configured
   * {@link MultipleDisposeBehavior} on a repeat dispose.
   */
  public [Symbol.dispose](): void {
    if (!shouldPerformDispose(this._isDisposed, this.multipleDisposeBehavior)) {
      return;
    }

    this._isDisposed = true;
    this.performDispose();
  }

  /**
   * Performs the actual teardown. Called at most once unless {@link MultipleDisposeBehavior.Invoke} is set.
   */
  protected abstract performDispose(): void;
}

/**
 * A disposable that executes a callback when disposed.
 */
export class CallbackDisposable extends DisposableBase {
  private readonly callback: DisposeCallback;

  /**
   * Creates a new instance of {@link CallbackDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: CallbackDisposableConstructorParams) {
    super();
    this.callback = params.callback;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Ignore;
  }

  /**
   * Runs the dispose callback.
   */
  protected override performDispose(): void {
    this.callback();
  }
}

/**
 * An {@link AsyncDisposableEx} that combines multiple async disposables and disposes all of them when it
 * is disposed.
 */
export class CombineAsyncDisposable extends AsyncDisposableBase {
  private readonly children: readonly AsyncDisposable[];
  private readonly disposeOrder: DisposeOrder;
  private readonly errorBehavior: DisposeErrorBehavior;

  /**
   * Creates a new instance of {@link CombineAsyncDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: CombineAsyncDisposableConstructorParams) {
    super();
    this.children = [...params.asyncDisposables];
    this.disposeOrder = params.disposeOrder ?? DisposeOrder.Lifo;
    this.errorBehavior = params.errorBehavior ?? DisposeErrorBehavior.Aggregate;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Ignore;
  }

  /**
   * Disposes all combined children in the configured {@link DisposeOrder}, applying the configured
   * {@link DisposeErrorBehavior} when a child throws.
   *
   * @returns A {@link Promise} that resolves once all children have been disposed.
   */
  protected override async performDisposeAsync(): Promise<void> {
    const errors: unknown[] = [];
    for (const child of this.getOrderedChildren()) {
      try {
        await child[Symbol.asyncDispose]();
      } catch (error) {
        if (this.errorBehavior === DisposeErrorBehavior.FailFast) {
          throw error;
        }

        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors);
    }
  }

  private getOrderedChildren(): readonly AsyncDisposable[] {
    switch (this.disposeOrder) {
      case DisposeOrder.Fifo:
        return this.children;
      case DisposeOrder.Lifo:
        return [...this.children].reverse();
      default:
        assertNever(this.disposeOrder);
    }
  }
}

/**
 * A {@link DisposableEx} that combines multiple disposables and disposes all of them when it is
 * disposed.
 */
export class CombineDisposable extends DisposableBase {
  private readonly children: readonly Disposable[];
  private readonly disposeOrder: DisposeOrder;
  private readonly errorBehavior: DisposeErrorBehavior;

  /**
   * Creates a new instance of {@link CombineDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: CombineDisposableConstructorParams) {
    super();
    this.children = [...params.disposables];
    this.disposeOrder = params.disposeOrder ?? DisposeOrder.Lifo;
    this.errorBehavior = params.errorBehavior ?? DisposeErrorBehavior.Aggregate;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Ignore;
  }

  /**
   * Disposes all combined children in the configured {@link DisposeOrder}, applying the configured
   * {@link DisposeErrorBehavior} when a child throws.
   */
  protected override performDispose(): void {
    const errors: unknown[] = [];
    for (const child of this.getOrderedChildren()) {
      try {
        child[Symbol.dispose]();
      } catch (error) {
        if (this.errorBehavior === DisposeErrorBehavior.FailFast) {
          throw error;
        }

        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors);
    }
  }

  private getOrderedChildren(): readonly Disposable[] {
    switch (this.disposeOrder) {
      case DisposeOrder.Fifo:
        return this.children;
      case DisposeOrder.Lifo:
        return [...this.children].reverse();
      default:
        assertNever(this.disposeOrder);
    }
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
 * Type guard to check if an object implements the {@link AsyncDisposableEx} interface.
 *
 * @param obj - the object to check for the {@link AsyncDisposableEx} interface
 * @returns Whether the object implements the {@link AsyncDisposableEx} interface
 */
export function isAsyncDisposableEx(obj: unknown): obj is AsyncDisposableEx {
  const asyncDisposableEx = obj as Partial<AsyncDisposableEx>;
  return isAsyncDisposable(obj) && typeof asyncDisposableEx.asyncDispose === 'function';
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

/**
 * Type guard to check if an object implements the {@link DisposableEx} interface.
 *
 * @param obj - the object to check for the {@link DisposableEx} interface
 * @returns Whether the object implements the {@link DisposableEx} interface
 */
export function isDisposableEx(obj: unknown): obj is DisposableEx {
  const disposableEx = obj as Partial<DisposableEx>;
  return isDisposable(obj) && typeof disposableEx.dispose === 'function';
}

/**
 * Adapts a plain {@link AsyncDisposable} into an {@link AsyncDisposableEx} by adding a convenience
 * {@link AsyncDisposableEx.asyncDispose} method that delegates to `Symbol.asyncDispose`.
 *
 * If the object already implements {@link AsyncDisposableEx}, it is returned unchanged.
 *
 * @param asyncDisposable - the async disposable to adapt
 * @returns An {@link AsyncDisposableEx} wrapping the async disposable.
 */
export function toAsyncDisposableEx(asyncDisposable: AsyncDisposable): AsyncDisposableEx {
  if (isAsyncDisposableEx(asyncDisposable)) {
    return asyncDisposable;
  }

  return {
    asyncDispose,
    [Symbol.asyncDispose]: asyncDispose
  };

  function asyncDispose(): Promise<void> {
    return Promise.resolve(asyncDisposable[Symbol.asyncDispose]());
  }
}

/**
 * Adapts a plain {@link Disposable} into a {@link DisposableEx} by adding a convenience
 * {@link DisposableEx.dispose} method that delegates to `Symbol.dispose`.
 *
 * If the object already implements {@link DisposableEx}, it is returned unchanged.
 *
 * @param disposable - the disposable to adapt
 * @returns A {@link DisposableEx} wrapping the disposable.
 */
export function toDisposableEx(disposable: Disposable): DisposableEx {
  if (isDisposableEx(disposable)) {
    return disposable;
  }

  return {
    dispose,
    [Symbol.dispose]: dispose
  };

  function dispose(): void {
    disposable[Symbol.dispose]();
  }
}

/**
 * Decides whether a disposable's teardown should run on the current dispose call, applying the
 * {@link MultipleDisposeBehavior} re-dispose policy. Single source of the guard shared by
 * {@link DisposableBase} and {@link AsyncDisposableBase}.
 *
 * @param isDisposed - Whether the disposable has already been disposed once.
 * @param multipleDisposeBehavior - The re-dispose behavior.
 * @returns `true` when the teardown should run, `false` when it should be skipped.
 */
function shouldPerformDispose(isDisposed: boolean, multipleDisposeBehavior: MultipleDisposeBehavior): boolean {
  if (!isDisposed) {
    return true;
  }

  switch (multipleDisposeBehavior) {
    case MultipleDisposeBehavior.Ignore:
      return false;
    case MultipleDisposeBehavior.Invoke:
      return true;
    case MultipleDisposeBehavior.Throw:
      throw new Error('This disposable has already been disposed.');
    default:
      assertNever(multipleDisposeBehavior);
  }
}
