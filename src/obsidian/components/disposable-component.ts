/**
 * @file
 *
 * Disposable component base class and utilities for `using` declarations.
 */

import { Component } from 'obsidian';

import type { DisposableEx } from '../../disposable.ts';

type DisposableComponentWrapper<TComponent extends Component> = DisposableEx & TComponent;

/**
 * Convert component to a {@link DisposableEx} interface by adding `Symbol.dispose` and a convenience
 * {@link DisposableEx.dispose} method that unloads the component when disposed.
 *
 * An existing `Symbol.dispose` is preserved; the convenience {@link DisposableEx.dispose} method always
 * delegates to it. The passed component is mutated in place and returned, so the call is idempotent.
 *
 * @typeParam TComponent - The type of component to wrap, constrained to extend Component.
 *
 * @param component - The component instance to wrap with Disposable support.
 * @returns The component cast to `DisposableComponentWrapper` with `Symbol.dispose` and `dispose`
 *   attached.
 */
export function asDisposableComponent<TComponent extends Component>(component: TComponent): DisposableComponentWrapper<TComponent> {
  const disposableEx = component as Partial<DisposableEx>;
  const symbolDispose: () => void = disposableEx[Symbol.dispose] ?? ((): void => {
    component.unload();
  });
  disposableEx[Symbol.dispose] = symbolDispose;
  disposableEx.dispose = (): void => {
    symbolDispose();
  };
  return disposableEx as DisposableComponentWrapper<TComponent>;
}
