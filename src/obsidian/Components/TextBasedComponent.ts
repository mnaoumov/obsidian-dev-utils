/**
 * @packageDocumentation
 *
 * Text based component utilities.
 */

import type { BaseComponent } from 'obsidian';

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

/**
 * Gets the text based component value of the component.
 *
 * @typeParam T - The type of the value to get.
 * @param component - The component to get the text based component value of.
 * @returns The text based component value of the component or `null` if the component is not a text based component.
 */
export function getTextBasedComponentValue<T>(component: BaseComponent): null | TextBasedComponent<T> {
  if (isTextBasedComponent(component)) {
    return component;
  }

  if (component instanceof AbstractTextComponent) {
    return {
      empty(): void {
        component.setValue('');
      },
      isEmpty(): boolean {
        return component.getValue() === '';
      },
      setPlaceholderValue(placeholderValue: T): TextBasedComponent<T> {
        component.setPlaceholder(placeholderValue as string);
        return this;
      }
    };
  }

  return null;
}

function isTextBasedComponent<T>(component: unknown): component is TextBasedComponent<T> {
  const textBasedComponent = component as Partial<TextBasedComponent<T>>;
  return typeof textBasedComponent.setPlaceholderValue === 'function' && typeof textBasedComponent.isEmpty === 'function';
}
