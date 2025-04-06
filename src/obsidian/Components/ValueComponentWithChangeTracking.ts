/**
 * @packageDocumentation
 *
 * Contains a type that extends ValueComponent to allow for change tracking.
 */

import type { ValueComponent } from 'obsidian';
import type { Promisable } from 'type-fest';

/**
 * A ValueComponent that can track changes.
 *
 * @typeParam T - The type of the value to set.
 */
export interface ValueComponentWithChangeTracking<T> extends ValueComponent<T> {
  /**
   * Sets a callback function to be called when the value of the component changes.
   *
   * @param callback - A callback function that is called when the value of the component changes.
   */
  onChange(callback: (newValue: T) => Promisable<void>): this;
}
