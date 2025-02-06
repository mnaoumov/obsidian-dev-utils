/**
 * @packageDocumentation ValueComponentWithChangeTracking
 * Contains a type that extends ValueComponent to allow for change tracking.
 */

import { ValueComponent } from 'obsidian';

import type { MaybePromise } from '../../Async.ts';

/**
 * A ValueComponent that can track changes.
 */
export interface ValueComponentWithChangeTracking<T> extends ValueComponent<T> {
  /**
   * Sets a callback function to be called when the value of the component changes.
   *
   * @param callback - A callback function that is called when the value of the component changes.
   */
  onChange(callback: (newValue: T) => MaybePromise<void>): this;
}
