/**
 * @file
 *
 * Contains a type that extends ValueComponent to allow for change tracking.
 */

/* v8 ignore start -- Interface-only module; no runtime code to test. */

import type { ValueComponent } from 'obsidian';

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
  onChange(callback: (newValue: T) => void): this;
}

/* v8 ignore stop */
