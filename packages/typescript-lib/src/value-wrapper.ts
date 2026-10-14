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
export class ValueWrapper<T = unknown> {
  /**
   * Gets the wrapped value.
   *
   * @returns The wrapped value.
   * @throws An {@link Error} if the value has not been set.
   */
  public get value(): T {
    if (!this.hasValue) {
      throw new Error('Value is not set');
    }

    return this._value as T;
  }

  /**
   * Sets the wrapped value.
   *
   * @param value - The value to wrap.
   */
  public set value(value: T) {
    this._value = value;
    this.hasValue = true;
  }

  private _value: null | T = null;

  private hasValue = false;

  /**
   * Creates a new value wrapper. Use {@link ValueWrapper.of} or {@link ValueWrapper.unset} instead.
   */
  private constructor() {
    noop();
  }

  /**
   * Make wrapper from the value.
   *
   * @typeParam T - Type of the value to wrap.
   * @param value - The value to wrap.
   * @returns The wrapper.
   */
  public static of<T>(value: T): ValueWrapper<T> {
    const wrapper = new ValueWrapper<T>();
    wrapper.value = value;
    return wrapper;
  }

  /**
   * Make the wrapper with unset value.
   *
   * @typeParam T - Type of the value to wrap.
   * @returns The wrapper.
   */
  public static unset<T>(): ValueWrapper<T> {
    return new ValueWrapper<T>();
  }
}
