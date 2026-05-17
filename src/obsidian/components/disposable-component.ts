/**
 * @file
 *
 * Disposable component base class and utilities for `using` declarations.
 */

import { Component } from 'obsidian';

type DisposableComponentWrapper<TComponent extends Component> = Disposable & TComponent;

/**
 * A component that implements the Disposable interface for automatic resource cleanup.
 *
 * This class extends Obsidian's Component and provides a `Symbol.dispose` method
 * that delegates to the component's unload lifecycle method.
 */
export class DisposableComponent extends Component implements Disposable {
  /** */
  public [Symbol.dispose](): void {
    this.unload();
  }
}

/**
 * Convert component to a Disposable interface by adding a Symbol.dispose method.
 *
 * @typeParam TComponent - The type of component to wrap, constrained to extend Component.
 *
 * @param component - The component instance to wrap with Disposable support.
 * @returns The component cast to `DisposableComponentWrapper` with `Symbol.dispose` attached.
 */
export function asDisposableComponent<TComponent extends Component>(component: TComponent): DisposableComponentWrapper<TComponent> {
  if (isDisposable(component)) {
    return component;
  }

  const disposable = component as Partial<Disposable>;
  disposable[Symbol.dispose] = (): void => {
    component.unload();
  };
  return disposable as DisposableComponentWrapper<TComponent>;
}

/**
 * Type guard to check if an object implements the `Disposable` interface.
 *
 * @param obj The object to check for the `Disposable` interface
 * @returns Whether the object implements the `Disposable` interface
 */
export function isDisposable(obj: unknown): obj is Disposable {
  const disposable = obj as Partial<Disposable>;
  return !!disposable[Symbol.dispose];
}
