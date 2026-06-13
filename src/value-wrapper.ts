/**
 * @file
 *
 * Wrapper type for storing values.
 */

import { noop } from './function.ts';

/**
 * Wrapper type for storing values.
 *
 * @typeParam T - The type of the wrapped value.
 */
export class ValueWrapper<T> {
  /**
   * Creates a new value wrapper.
   *
   * @param value - The value to wrap.
   */
  public constructor(public value: T) {
    noop();
  }
}
