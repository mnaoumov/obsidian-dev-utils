/**
 * @file
 *
 * Extended Component
 */

import type { Promisable } from 'type-fest';

import { Component } from 'obsidian';

import { snapshot } from '../../array.ts';
import { dispose } from '../../disposable.ts';
import {
  ErrorWrapper,
  SilentError
} from '../../error.ts';
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
  private hasBeenLoaded = false;
  private loadErrors: Error[] = [];
  private loadPromise: null | Promise<void> = null;

  /**
   * Adds a child component.
   *
   * Mirrors the native `Component.addChild` contract: if this component is already loaded, the child is loaded
   * immediately, so `child._loaded` is set before this method returns even when this component has async load logic.
   * The child's async tail (if any) is sequenced into the load promise so a later {@link loadWithPromises} call awaits it.
   *
   * Adding a child BEFORE the first load is legitimate: the child is queued and loaded when this component loads.
   * Adding one AFTER this component has been unloaded is not — the child would never be loaded and never unloaded
   * (a leak), so it is refused with a {@link SilentError}. The typical source of such a call is an `async` method
   * that was suspended on an `await` when the component got unloaded and then resumed on the dead component; the
   * {@link SilentError} unwinds it quietly (see {@link isUnloaded}).
   *
   * @typeParam TComponent - The type of component to add.
   * @param component - The component instance to add.
   * @returns The added component.
   * @throws A {@link SilentError} if the component has already been unloaded.
   */
  public override addChild<TComponent extends Component>(component: TComponent): TComponent {
    if (this.isUnloaded()) {
      throw new SilentError('Component is already unloaded');
    }

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
    this.hasBeenLoaded = true;
    this.resetLoadState();

    this.onload();

    const onloadAsyncPromise = this.onloadAsync();
    if (onloadAsyncPromise !== noopAsyncSingletonPromise) {
      this.appendEagerLoadStep(onloadAsyncPromise);
    }

    for (const child of snapshot(this._children)) {
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
   * Registers a {@link Disposable} so it is disposed when this component unloads, and returns it unchanged.
   *
   * The recurring "tie a disposable to the component's lifecycle, then keep using it" idiom: the disposable is
   * disposed on {@link Component.unload} (or earlier, if the caller disposes it directly — dispose is expected to
   * be idempotent). Guard with {@link ensureLoaded} at the call site when registering before load would be unsafe.
   *
   * @typeParam TDisposable - The type of the disposable.
   * @param disposable - The disposable to register.
   * @returns The same disposable, for chaining.
   */
  public registerDisposable<TDisposable extends Disposable>(disposable: TDisposable): TDisposable {
    this.register(() => {
      dispose(disposable);
    });
    return disposable;
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
   * Ensures the component is loaded, throwing if it is not.
   *
   * Use this to guard public methods that register teardown-bearing resources (via {@link Component.register},
   * {@link Component.registerEvent}, {@link Component.registerDomEvent}, etc.). Registering before load is unsafe:
   * {@link Component.unload} is a no-op while the component is not loaded, so any teardown registered beforehand would
   * never run if the component is unloaded without first being loaded.
   *
   * The two not-loaded cases are deliberately distinguished. A component that was NEVER loaded is a genuine
   * programming error, so it throws a loud {@link Error}. A component that has ALREADY been unloaded is not —
   * it is the expected outcome of work that outlived its component (e.g. an `async` method suspended on an
   * `await` while the component was unloaded, then resumed) — so it throws a {@link SilentError}, which
   * `handleSilentError` suppresses, letting such work unwind quietly instead of reporting an async error.
   *
   * @throws An {@link Error} if the component was never loaded, or a {@link SilentError} if it has already been unloaded.
   */
  protected ensureLoaded(): void {
    if (this._loaded) {
      return;
    }

    if (this.isUnloaded()) {
      throw new SilentError('Component is already unloaded');
    }

    throw new Error('Component is not loaded');
  }

  /**
   * Returns the component's in-flight load {@link Promise} (its {@link onloadAsync} plus children), or `null` when
   * nothing is loading — either the component loaded fully synchronously or its async load has already settled.
   *
   * Lets a caller scheduled while the component is still loading await the async load tail before acting, instead of
   * racing it. The motivating case is a layout-ready handler (see `LayoutReadyComponent`) that fires because the
   * component was loaded after the workspace layout was already ready: {@link Component.onload} has run (so `_loaded`
   * is set) but {@link onloadAsync} may not have finished.
   *
   * @returns The in-flight load promise, or `null` if no load is in flight.
   */
  protected getInFlightLoadPromise(): null | Promise<void> {
    return this.loadPromise;
  }

  /**
   * Returns whether the most recent load recorded any failure.
   *
   * Reflects the outcome of the last {@link load} / {@link loadWithPromises}: `true` when {@link onloadAsync} or any
   * child's load threw (synchronously or asynchronously). Unlike {@link loadWithPromises}, reading this does NOT
   * re-raise the collected errors — it lets a bystander (e.g. a layout-ready handler awaiting the in-flight load) tell
   * whether the load succeeded without adopting a failure that the load's owner is already responsible for.
   *
   * @returns `true` if the last load recorded at least one error, otherwise `false`.
   */
  protected hasLoadErrors(): boolean {
    return this.loadErrors.length > 0;
  }

  /**
   * Returns whether the component has already been unloaded, as opposed to simply not having been loaded yet.
   *
   * Both states leave `_loaded` false, but they mean opposite things: a component that was never loaded is still
   * ahead of its lifecycle (queueing children before load is legitimate), while an unloaded one is behind it and
   * must not be used any further. The distinction is tracked by a flag set in {@link load}, NOT by an
   * {@link Component.onunload} override, because subclasses override `onunload` and may not call `super`.
   *
   * Use it in a long-running `async` method to abandon work whose component was unloaded mid-flight, when
   * unwinding via the {@link SilentError} thrown by {@link ensureLoaded} / {@link addChild} is not desired.
   *
   * @returns `true` if the component was loaded at some point and is currently unloaded, otherwise `false`.
   */
  protected isUnloaded(): boolean {
    return this.hasBeenLoaded && !this._loaded;
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
   * @param loadPromisableFunction - A function that starts the load step and returns its result.
   */
  private appendSequentialLoadStep(loadPromisableFunction: () => null | Promisable<void>): void {
    const previous = this.loadPromise;
    if (previous) {
      this.setLoadPromise(previous.then(() => this.runAndCapture(loadPromisableFunction)));
      return;
    }

    const captured = this.captureSync(loadPromisableFunction);
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

    return Promise.resolve(loadPromisable).then(noop).catch((error: unknown) => {
      this.captureError(error);
    });
  }

  /**
   * Runs a load step synchronously, recording a synchronous throw, and wraps any async tail so it never rejects.
   *
   * @param loadPromisableFunction - A function that starts the load step and returns its result.
   * @returns A never-rejecting {@link Promise}, or `null` if the step is fully synchronous.
   */
  private captureSync(loadPromisableFunction: () => null | Promisable<void>): null | Promise<void> {
    let loadPromisable: null | Promisable<void>;
    try {
      loadPromisable = loadPromisableFunction();
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
   * @param loadPromisableFunction - A function that starts the load step and returns its result.
   */
  private async runAndCapture(loadPromisableFunction: () => null | Promisable<void>): Promise<void> {
    try {
      await (loadPromisableFunction() ?? undefined);
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
