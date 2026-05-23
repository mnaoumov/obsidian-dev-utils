/**
 * @file
 *
 * {@link RegistryComponent}.
 */

import type { Constructor } from 'type-fest';

import { ensureNonNullable } from '../../type-guards.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * A component that keeps registry of its children.
 */
export class RegistryComponent extends ComponentEx {
  /**
   * Get the single child of the given type.
   *
   * @typeParam TComponent - The type of component to get.
   * @param componentClass - The class of the component to get.
   * @returns The single registered child of the given type.
   */
  public getChild<TComponent>(componentClass: Constructor<TComponent>): TComponent {
    const child = this.getChildOrNull(componentClass);
    if (child) {
      return child;
    }

    throw new Error(`No instance of ${componentClass.name} registered`);
  }

  /**
   * Get the single child of the given type.
   *
   * @typeParam TComponent - The type of component to get.
   * @param componentClass - The class of the component to get.
   * @returns The single registered child of the given type, or `null` if none are registered.
   */
  public getChildOrNull<TComponent>(componentClass: Constructor<TComponent>): null | TComponent {
    const children = this.getChildren(componentClass);
    if (children.length === 0) {
      return null;
    }

    if (children.length === 1) {
      return ensureNonNullable(children[0]);
    }

    throw new Error(`Multiple instances of ${componentClass.name} registered`);
  }

  /**
   * Get all children of the given type.
   *
   * @typeParam TComponent - The type of component to get.
   * @param componentClass - The class of the component to get.
   * @returns All registered children of the given type.
   */
  public getChildren<TComponent>(componentClass: Constructor<TComponent>): TComponent[] {
    return this._children.filter((child) => child instanceof componentClass) as TComponent[];
  }
}
