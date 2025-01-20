/**
 * @packageDocumentation ValueComponent
 * Contains utility types and functions for handling value components, which are UI components that display and edit values.
 */

import {
  DropdownComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ValueComponent
} from 'obsidian';

import type { ValidatorElement } from '../../HTMLElement.ts';

/**
 * A ValueComponent that can track changes.
 */
export interface ValueComponentWithChangeTracking<T> extends ValueComponent<T> {
  /**
   * Sets a callback function to be called when the value of the component changes.
   *
   * @param callback - A callback function that is called when the value of the component changes.
   */
  onChange(callback: (newValue: T) => Promise<void>): this;
}

/**
 * Gets the validator element from a value component if it exists.
 *
 * @param valueComponent - The value component to get the validator element from.
 * @returns The validator element if it exists, or `null` if it does not.
 */
export function getValidatorElement<UIValue>(valueComponent: ValueComponentWithChangeTracking<UIValue>): null | ValidatorElement {
  if (valueComponent instanceof DropdownComponent) {
    return valueComponent.selectEl;
  }

  if (valueComponent instanceof SliderComponent) {
    return valueComponent.sliderEl;
  }

  if (valueComponent instanceof TextAreaComponent) {
    return valueComponent.inputEl;
  }

  if (valueComponent instanceof TextComponent) {
    return valueComponent.inputEl;
  }

  return null;
}
