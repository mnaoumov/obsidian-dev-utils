/**
 * @file
 *
 * Contains a component that has a validator element.
 */

import {
  ColorComponent,
  DropdownComponent,
  ProgressBarComponent,
  SearchComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ToggleComponent
} from 'obsidian';

import type { ValidatorElement } from '../../html-element.ts';

import { CssClass } from '../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';
import { ensureWrapped } from './setting-component-wrapper.ts';

/**
 * A component that has a validator element.
 */
export interface ValidatorComponent {
  /**
   * A validator element of the component.
   */
  readonly validatorElement: ValidatorElement;
}

class OverlayValidatorComponent implements ValidatorComponent {
  public get validatorElement(): ValidatorElement {
    return this._validatorElement;
  }

  private readonly _validatorElement: ValidatorElement;

  public constructor(private readonly element: HTMLElement) {
    const wrapper = ensureWrapped(element);

    this._validatorElement = wrapper.createEl('input', {
      attr: {
        tabindex: -1
      }
    });
    addPluginCssClasses(this._validatorElement, CssClass.OverlayValidator);

    this._validatorElement.addEventListener('focus', () => {
      this.element.focus();
    });

    this._validatorElement.isActiveElement = this.isElementOrDescendantActive.bind(this);

    let tabIndexElement = this.element.querySelector<HTMLElement>('[tabindex]');
    if (!tabIndexElement) {
      if (this.element.getAttr('tabindex') === null) {
        this.element.tabIndex = -1;
      }
      tabIndexElement = this.element;
    }

    this.element.addEventListener('focusin', () => {
      this.forceBlurValidatorEl();
    });
    this.element.addEventListener('click', () => {
      tabIndexElement.focus();
    });
    this.element.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (this.isElementOrDescendantActive()) {
          return;
        }

        this.forceBlurValidatorEl();
      }, 0);
    });
  }

  private forceBlurValidatorEl(): void {
    this._validatorElement.dispatchEvent(new Event('blur'));
  }

  private isElementOrDescendantActive(): boolean {
    return this.element.contains(activeDocument.activeElement);
  }
}

class ValidatorElementWrapper implements ValidatorComponent {
  public constructor(public readonly validatorElement: ValidatorElement) {}
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

  if (obj instanceof ColorComponent) {
    return new ValidatorElementWrapper(obj.colorPickerEl);
  }

  if (obj instanceof DropdownComponent) {
    return new ValidatorElementWrapper(obj.selectEl);
  }

  if (obj instanceof ProgressBarComponent) {
    return new OverlayValidatorComponent(obj.progressBar);
  }

  if (obj instanceof SearchComponent) {
    return new ValidatorElementWrapper(obj.inputEl);
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
    return new OverlayValidatorComponent(obj.toggleEl);
  }

  return null;
}

function isValidatorComponent($object: unknown): $object is ValidatorComponent {
  return typeof $object === 'object' && $object !== null && 'validatorElement' in $object && !!($object as Partial<ValidatorComponent>).validatorElement;
}
