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
 * Gets a validator component related to the base component
 *
 * @param baseComponent - A base component
 * @returns related validator component or `null` if no related validator component is found
 */
export function getValidatorComponent(baseComponent: BaseComponent): null | ValidatorComponent {
  const validatorComponent = baseComponent as Partial<ValidatorComponent>;

  if (validatorComponent.validatorEl) {
    return validatorComponent as ValidatorComponent;
  }

  if (baseComponent instanceof DropdownComponent) {
    return {
      get validatorEl(): ValidatorElement {
        return baseComponent.selectEl;
      }
    };
  }

  if (baseComponent instanceof SliderComponent) {
    return {
      get validatorEl(): ValidatorElement {
        return baseComponent.sliderEl;
      }
    };
  }

  if (baseComponent instanceof TextAreaComponent) {
    return {
      get validatorEl(): ValidatorElement {
        return baseComponent.inputEl;
      }
    };
  }

  if (baseComponent instanceof TextComponent) {
    return {
      get validatorEl(): ValidatorElement {
        return baseComponent.inputEl;
      }
    };
  }

  return null;
}
