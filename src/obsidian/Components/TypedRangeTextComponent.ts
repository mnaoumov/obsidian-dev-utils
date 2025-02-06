/**
 * @packageDocumentation TypedRangeTextComponent
 * Contains a component that displays and edits a text-based value with a range.
 */

import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits a text-based value with a range.
 */
export abstract class TypedRangeTextComponent<T> extends TypedTextComponent<T> {
  /**
   * Sets the maximum value of the component.
   *
   * @param max - The maximum value.
   * @returns The component.
   */
  public setMax(max: T): this {
    this.inputEl.max = this.valueToString(max);
    return this;
  }

  /**
   * Sets the minimum value of the component.
   *
   * @param min - The minimum value.
   * @returns The component.
   */
  public setMin(min: T): this {
    this.inputEl.min = this.valueToString(min);
    return this;
  }

  /**
   * Sets the step value of the component.
   *
   * @param step - The step value.
   * @returns The component.
   */
  public setStep(step: number): this {
    this.inputEl.step = step.toString();
    return this;
  }
}
