/**
 * @packageDocumentation
 *
 * Text based component utilities.
 */

import { AbstractTextComponent } from 'obsidian';

/**
 * A component based on a text input.
 *
 * @typeParam T - The type of the value to set.
 */
export interface TextBasedComponent<T> {
  /**
   * Empties the component.
   */
  empty(): void;

  /**
   * Checks if the component is empty.
   *
   * @returns `true` if the component is empty, `false` otherwise.
   */
  isEmpty(): boolean;

  /**
   * Sets the placeholder value of the component.
   *
   * @param placeholderValue - The placeholder value to set.
   * @returns The component.
   */
  setPlaceholderValue(placeholderValue: T): this;
}

class AbstractTextComponentWrapper<T> implements TextBasedComponent<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `unknown` doesn't work, getting compiler errors.
  public constructor(private readonly abstractTextComponent: AbstractTextComponent<any>) {}

  public empty(): void {
    this.abstractTextComponent.setValue('');
  }

  public isEmpty(): boolean {
    return this.abstractTextComponent.getValue() === '';
  }

  public setPlaceholderValue(placeholderValue: T): this {
    this.abstractTextComponent.setPlaceholder(placeholderValue as string);
    return this;
  }
}

/**
 * Gets the text based component value of the component.
 *
 * @typeParam T - The type of the value to get.
 * @param obj - Any object.
 * @returns The text based component value of the component or `null` if the component is not a text based component.
 */
export function getTextBasedComponentValue<T>(obj: unknown): null | TextBasedComponent<T> {
  if (isTextBasedComponent(obj)) {
    return obj;
  }

  if (obj instanceof AbstractTextComponent) {
    return new AbstractTextComponentWrapper<T>(obj);
  }

  return null;
}

function isTextBasedComponent<T>(component: unknown): component is TextBasedComponent<T> {
  const textBasedComponent = component as Partial<TextBasedComponent<T>>;
  return typeof textBasedComponent.setPlaceholderValue === 'function' && typeof textBasedComponent.isEmpty === 'function';
}
