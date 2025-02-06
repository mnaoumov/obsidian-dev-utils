/**
 * @packageDocumentation ValidatorComponent
 * Contains a component that has a validator element.
 */

import type { BaseComponent } from 'obsidian';

import {
  DropdownComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent
} from 'obsidian';

import type { ValidatorElement } from '../../HTMLElement.ts';

/**
 * A component that has a validator element.
 */
export interface ValidatorComponent {
  /**
   * The validator element of the component.
   */
  readonly validatorEl: ValidatorElement;
}

/**
 * Gets the validator element from a value component if it exists.
 *
 * @param valueComponent - The value component to get the validator element from.
 * @returns The validator element if it exists, or `null` if it does not.
 */
export function getValidatorElement(valueComponent: BaseComponent): null | ValidatorElement {
  const validatorComponent = valueComponent as Partial<ValidatorComponent>;

  if (validatorComponent.validatorEl) {
    return validatorComponent.validatorEl;
  }

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
