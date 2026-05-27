/**
 * @file
 *
 * Extended Component
 */

import type { Promisable } from 'type-fest';

import { Component } from 'obsidian';

import { chain } from '../../async.ts';
import { noopAsyncSingletonPromise } from '../../function.ts';

/**
 * Extended Component
 */
// eslint-disable-next-line obsidian-dev-utils/require-component-suffix -- Extended base class.
export class ComponentEx extends Component implements Disposable {
  private readonly childrenSet = new Set<Component>();
  private loadPromise: null | Promise<void> = null;

  /**
   * Adds a child component.
   *
   * @typeParam TComponent - The type of component to add.
   * @param component - The component instance to add.
   * @returns The added component.
   */
  public override addChild<TComponent extends Component>(component: TComponent): TComponent {
    this._children.push(component);
    this.childrenSet.add(component);

    if (this._loaded) {
      this.loadPromise = chain(this.loadPromise, () => this.extractLoadPromisable(component));
    }

    return component;
  }

  /**
   * Loads the component.
   *
   * @returns Despite the declared `void` return type, this method returns a {@link Promise} that resolves when the component is loaded or `null` if the component if fully synchronous.
   */
  public override load(): void {
    if (this._loaded) {
      return;
    }

    this._loaded = true;

    this.onload();
    const onloadAsyncPromise = this.onloadAsync();
    if (onloadAsyncPromise !== noopAsyncSingletonPromise) {
      this.loadPromise = chain(this.loadPromise, () => onloadAsyncPromise);
    }

    for (const child of this._children.slice()) {
      this.loadPromise = chain(this.loadPromise, () => this.extractLoadPromisable(child));
    }

    if (this.loadPromise) {
      // eslint-disable-next-line @typescript-eslint/no-invalid-void-type, no-restricted-syntax -- We need to bypass type system to return `Promise<void>`.
      return this.loadPromise as unknown as void;
    }
  }

  /**
   * Loads the component with promises.
   *
   * @returns A {@link Promise} that resolves when the component is loaded or `null` if the component and its children don't use `async` logic.
   */
  public loadWithPromises(): null | Promise<void> {
    this.load();
    return this.loadPromise;
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
}
