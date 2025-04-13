/**
 * @packageDocumentation
 *
 * Contains a component that has a validator element.
 */

import {
  DropdownComponent,
  setTooltip,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ToggleComponent
} from 'obsidian';

import type { ValidatorElement } from '../../../HTMLElement.ts';

import { around } from '../../MonkeyAround.ts';

/**
 * A component that has a validator element.
 */
export interface ValidatorComponent {
  /**
   * The validator element of the component.
   */
  readonly validatorEl: ValidatorElement;
}

type SetCustomValidityFn = HTMLInputElement['setCustomValidity'];

class ValidatorElementWrapper implements ValidatorComponent {
  public constructor(public readonly validatorEl: ValidatorElement) {}
}

/**
 * Gets a validator component related to the given object.
 *
 * @param obj - Any object.
 * @returns The related validator component or `null` if no related validator component is found.
 */
export function getValidatorComponent(obj: unknown): null | ValidatorComponent {
  if (isValidatorComponent(obj)) {
    return obj;
  }

  if (obj instanceof DropdownComponent) {
    return new ValidatorElementWrapper(obj.selectEl);
  }

  if (obj instanceof SliderComponent) {
    return new ValidatorElementWrapper(obj.sliderEl);
  }

  if (obj instanceof TextAreaComponent) {
    return new ValidatorElementWrapper(obj.inputEl);
  }

  if (obj instanceof TextComponent) {
    return new ValidatorElementWrapper(obj.inputEl);
  }

  if (obj instanceof ToggleComponent) {
    const hiddenCheckbox = obj.toggleEl.find('input[type=checkbox]') as HTMLInputElement;
    around(hiddenCheckbox, {
      setCustomValidity: (next: SetCustomValidityFn): SetCustomValidityFn => {
        return function setCustomValidity(this: HTMLInputElement, error: string) {
          next.call(this, error);
          const isValid = this.checkValidity();
          obj.toggleEl.toggleClass('invalid', !isValid);
          setTooltip(obj.toggleEl, this.validationMessage);
        };
      }
    });

    return new ValidatorElementWrapper(hiddenCheckbox);
  }

  return null;
}

function isValidatorComponent(obj: unknown): obj is ValidatorComponent {
  return !!(obj as Partial<ValidatorComponent>).validatorEl;
}
