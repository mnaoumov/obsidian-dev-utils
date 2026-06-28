/**
 * @file
 *
 * Disposable component base class and utilities for `using` declarations.
 */

import { Component } from 'obsidian';

import { isDisposable } from '../../disposable.ts';

type DisposableComponentWrapper<TComponent extends Component> = Disposable & TComponent;

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
