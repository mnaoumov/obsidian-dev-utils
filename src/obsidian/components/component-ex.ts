/**
 * @file
 *
 * Extended Component
 */

import type { Promisable } from 'type-fest';

import { Component } from 'obsidian';

import { ErrorWrapper } from '../../error.ts';
import {
  noop,
  noopAsyncSingletonPromise
} from '../../function.ts';

/**
 * Extended Component
 */
// eslint-disable-next-line obsidian-dev-utils/require-component-suffix -- Extended base class.
export class ComponentEx extends Component implements Disposable {
  private readonly childrenSet = new Set<Component>();
  private loadErrors: Error[] = [];
  private loadPromise: null | Promise<void> = null;

  /**
   * Adds a child component.
   *
   * Mirrors the native `Component.addChild` contract: if this component is already loaded, the child is loaded
   * immediately, so `child._loaded` is set before this method returns even when this component has async load logic.
   * The child's async tail (if any) is sequenced into the load promise so a later {@link loadWithPromises} call awaits it.
   *
   * @typeParam TComponent - The type of component to add.
   * @param component - The component instance to add.
   * @returns The added component.
   */
  public override addChild<TComponent extends Component>(component: TComponent): TComponent {
    this._children.push(component);
    this.childrenSet.add(component);

    if (this._loaded) {
      this.appendEagerLoadStep(this.extractLoadPromisable(component));
    }

    return component;
  }

  /**
   * Loads the component.
   *
   * @returns Despite the declared `void` return type, this method returns a {@link Promise} that resolves when the component is loaded or `null` if the component is fully synchronous.
   */
  public override load(): void {
    if (this._loaded) {
      return;
    }

    this._loaded = true;
    this.resetLoadState();

    this.onload();

    const onloadAsyncPromise = this.onloadAsync();
    if (onloadAsyncPromise !== noopAsyncSingletonPromise) {
      this.appendEagerLoadStep(onloadAsyncPromise);
    }

    for (const child of this._children.slice()) {
      this.appendSequentialLoadStep(() => this.extractLoadPromisable(child));
    }

    if (this.loadPromise) {
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type, no-restricted-syntax -- We need to bypass type system to return `Promise<void>`.
      return this.loadPromise as unknown as void;
    }
  }

  /**
   * Loads the component with promises.
   *
   * Unlike {@link load}, this method never rejects with an individual error: every failure raised by {@link onloadAsync}
   * or a child's load is collected, and once everything settles the returned {@link Promise} rejects with a single
   * {@link AggregateError} holding all of them. Non-`Error` throwables are normalized via {@link ErrorWrapper.create}.
   *
   * @returns A {@link Promise} that resolves when the component and its children finish loading, rejects with an {@link AggregateError} if any load step failed, or `null` if the component and its children don't use `async` logic and none failed synchronously.
   */
  public loadWithPromises(): null | Promise<void> {
    this.load();

    const loadPromise = this.loadPromise;
    if (!loadPromise) {
      if (this.loadErrors.length > 0) {
        return Promise.reject(new AggregateError(this.loadErrors));
      }
      return null;
    }

    return loadPromise.then(() => {
      if (this.loadErrors.length > 0) {
        throw new AggregateError(this.loadErrors);
      }
    });
  }

  /**
   * Asynchronously loads the component.
   *
   * Override to add async load logic, which is executed after {@link Component.onload}.
   *
   * @returns A {@link Promise} that resolves when the component is loaded.
   */
  public onloadAsync(): Promise<void> {
    return noopAsyncSingletonPromise;
  }

  /**
   * Removes a child component.
   *
   * @typeParam TComponent - The type of component to remove.
   * @param component - The component instance to remove.
   * @returns The removed component.
   */
  public override removeChild<TComponent extends Component>(component: TComponent): TComponent {
    super.removeChild(component);
    this.childrenSet.delete(component);
    return component;
  }

  /**
   * Disposes of the component.
   */
  public [Symbol.dispose](): void {
    this.unload();
  }

  /**
   * Sequences an already-started load step into the load promise.
   *
   * The step is presumed to have started synchronously (so any `_loaded` flag it sets is already visible); only the
   * awaiting of its async tail is sequenced here.
   *
   * @param loadPromisable - The result of an already-started load step.
   */
  private appendEagerLoadStep(loadPromisable: null | Promisable<void>): void {
    const captured = this.captureSettled(loadPromisable);
    if (!captured) {
      return;
    }

    const previous = this.loadPromise;
    this.setLoadPromise(previous ? previous.then(() => captured) : captured);
  }

  /**
   * Sequences a deferred load step into the load promise, running it only after previously-appended steps settle.
   *
   * @param loadPromisableFn - A function that starts the load step and returns its result.
   */
  private appendSequentialLoadStep(loadPromisableFn: () => null | Promisable<void>): void {
    const previous = this.loadPromise;
    if (previous) {
      this.setLoadPromise(previous.then(() => this.runAndCapture(loadPromisableFn)));
      return;
    }

    const captured = this.captureSync(loadPromisableFn);
    if (captured) {
      this.setLoadPromise(captured);
    }
  }

  /**
   * Records a load failure.
   *
   * A failure raised by a child {@link ComponentEx} is itself an {@link AggregateError}; it is recorded as-is so the
   * grouping by child component is preserved (own failures stay flat, child-subtree failures stay nested).
   *
   * @param error - The thrown value to record.
   */
  private captureError(error: unknown): void {
    this.loadErrors.push(ErrorWrapper.create(error));
  }

  /**
   * Wraps an already-started load result so it never rejects: any failure is recorded into `loadErrors`.
   *
   * @param loadPromisable - The load result to observe.
   * @returns A never-rejecting {@link Promise}, or `null` if the result is fully synchronous.
   */
  private captureSettled(loadPromisable: null | Promisable<void>): null | Promise<void> {
    if (loadPromisable === null || loadPromisable === undefined) {
      return null;
    }

    return Promise.resolve(loadPromisable).then(noop, (error: unknown) => {
      this.captureError(error);
    });
  }

  /**
   * Runs a load step synchronously, recording a synchronous throw, and wraps any async tail so it never rejects.
   *
   * @param loadPromisableFn - A function that starts the load step and returns its result.
   * @returns A never-rejecting {@link Promise}, or `null` if the step is fully synchronous.
   */
  private captureSync(loadPromisableFn: () => null | Promisable<void>): null | Promise<void> {
    let loadPromisable: null | Promisable<void>;
    try {
      loadPromisable = loadPromisableFn();
    } catch (error) {
      this.captureError(error);
      return null;
    }

    return this.captureSettled(loadPromisable);
  }

  private extractLoadPromisable(component: Component): null | Promisable<void> {
    if (!this.childrenSet.has(component)) {
      return null;
    }
    if (component instanceof ComponentEx) {
      return component.loadWithPromises();
    }
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-unnecessary-type-assertion -- It can be `Promise<void>` in runtime. Want explicitly cast to show we know it may be promise, despite the declared type `void`.
    return component.load() as Promisable<void>;
  }

  private resetLoadState(): void {
    this.loadErrors = [];
    this.loadPromise = null;
  }

  /**
   * Runs a deferred load step, recording a synchronous throw or an async rejection without ever re-throwing.
   *
   * @param loadPromisableFn - A function that starts the load step and returns its result.
   */
  private async runAndCapture(loadPromisableFn: () => null | Promisable<void>): Promise<void> {
    try {
      await (loadPromisableFn() ?? undefined);
    } catch (error) {
      this.captureError(error);
    }
  }

  private setLoadPromise(loadPromise: Promise<void>): void {
    const loadPromiseWithReset: Promise<void> = loadPromise.then(() => {
      if (this.loadPromise === loadPromiseWithReset) {
        this.loadPromise = null;
      }
    });
    this.loadPromise = loadPromiseWithReset;
  }
}
