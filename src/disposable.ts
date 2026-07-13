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
   * @default {@link MultipleDisposeBehavior.Invoke}
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
   * @default {@link MultipleDisposeBehavior.Invoke}
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
   * @default {@link MultipleDisposeBehavior.Invoke}
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
   * @default {@link MultipleDisposeBehavior.Invoke}
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
 * An async disposable that executes a callback when disposed via `await using` (or a manual
 * `await disposable[Symbol.asyncDispose]()`).
 */
export class AsyncCallbackDisposable implements AsyncDisposableEx {
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
   * Disposes the object by executing the callback. Convenience alias that delegates to
   * `this[Symbol.asyncDispose]()`.
   *
   * @returns A {@link Promise} that resolves once the callback completes.
   */
  public asyncDispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
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
export class CallbackDisposable implements DisposableEx {
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
   * Disposes the object by executing the callback. Convenience alias that delegates to
   * `this[Symbol.dispose]()`.
   */
  public dispose(): void {
    this[Symbol.dispose]();
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
 * An {@link AsyncDisposableEx} that combines multiple async disposables and disposes all of them when it
 * is disposed.
 */
export class CombineAsyncDisposable implements AsyncDisposableEx {
  private readonly children: readonly AsyncDisposable[];
  private readonly disposeOrder: DisposeOrder;
  private readonly errorBehavior: DisposeErrorBehavior;
  private isDisposed = false;
  private readonly multipleDisposeBehavior: MultipleDisposeBehavior;

  /**
   * Creates a new instance of {@link CombineAsyncDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: CombineAsyncDisposableConstructorParams) {
    this.children = [...params.asyncDisposables];
    this.disposeOrder = params.disposeOrder ?? DisposeOrder.Lifo;
    this.errorBehavior = params.errorBehavior ?? DisposeErrorBehavior.Aggregate;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Invoke;
  }

  /**
   * Disposes all combined children. Convenience alias that delegates to
   * `this[Symbol.asyncDispose]()`.
   *
   * @returns A {@link Promise} that resolves once all children have been disposed.
   */
  public asyncDispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  /**
   * Disposes all combined children in the configured {@link DisposeOrder}, applying the configured
   * {@link DisposeErrorBehavior} when a child throws.
   *
   * This method is called automatically when the object is used in an `await using` declaration. It can
   * also be called manually. The behavior on a second and later dispose is controlled by
   * {@link CombineAsyncDisposableConstructorParams.multipleDisposeBehavior}.
   *
   * @returns A {@link Promise} that resolves once all children have been disposed.
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    if (this.isDisposed) {
      switch (this.multipleDisposeBehavior) {
        case MultipleDisposeBehavior.Ignore:
          return;
        case MultipleDisposeBehavior.Invoke:
          break;
        case MultipleDisposeBehavior.Throw:
          throw new Error('This CombineAsyncDisposable has already been disposed.');
        default:
          assertNever(this.multipleDisposeBehavior);
      }
    }

    this.isDisposed = true;

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
export class CombineDisposable implements DisposableEx {
  private readonly children: readonly Disposable[];
  private readonly disposeOrder: DisposeOrder;
  private readonly errorBehavior: DisposeErrorBehavior;
  private isDisposed = false;
  private readonly multipleDisposeBehavior: MultipleDisposeBehavior;

  /**
   * Creates a new instance of {@link CombineDisposable}.
   *
   * @param params - The parameters.
   */
  public constructor(params: CombineDisposableConstructorParams) {
    this.children = [...params.disposables];
    this.disposeOrder = params.disposeOrder ?? DisposeOrder.Lifo;
    this.errorBehavior = params.errorBehavior ?? DisposeErrorBehavior.Aggregate;
    this.multipleDisposeBehavior = params.multipleDisposeBehavior ?? MultipleDisposeBehavior.Invoke;
  }

  /**
   * Disposes all combined children. Convenience alias that delegates to `this[Symbol.dispose]()`.
   */
  public dispose(): void {
    this[Symbol.dispose]();
  }

  /**
   * Disposes all combined children in the configured {@link DisposeOrder}, applying the configured
   * {@link DisposeErrorBehavior} when a child throws.
   *
   * This method is called automatically when the object is used in a `using` declaration. It can also
   * be called manually. The behavior on a second and later dispose is controlled by
   * {@link CombineDisposableConstructorParams.multipleDisposeBehavior}.
   */
  public [Symbol.dispose](): void {
    if (this.isDisposed) {
      switch (this.multipleDisposeBehavior) {
        case MultipleDisposeBehavior.Ignore:
          return;
        case MultipleDisposeBehavior.Invoke:
          break;
        case MultipleDisposeBehavior.Throw:
          throw new Error('This CombineDisposable has already been disposed.');
        default:
          assertNever(this.multipleDisposeBehavior);
      }
    }

    this.isDisposed = true;

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
