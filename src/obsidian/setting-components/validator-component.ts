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
  readonly validatorEl: ValidatorElement;
}

class OverlayValidatorComponent implements ValidatorComponent {
  public get validatorEl(): ValidatorElement {
    return this._validatorEl;
  }

  private readonly _validatorEl: ValidatorElement;

  public constructor(private readonly element: HTMLElement) {
    const wrapper = ensureWrapped(element);

    this._validatorEl = wrapper.createEl('input', {
      attr: {
        tabindex: -1
      }
    });
    addPluginCssClasses(this._validatorEl, CssClass.OverlayValidator);

    this._validatorEl.addEventListener('focus', () => {
      this.element.focus();
    });

    this._validatorEl.isActiveElement = this.isElementOrDescendantActive.bind(this);

    let tabIndexEl = this.element.querySelector<HTMLElement>('[tabindex]');
    if (!tabIndexEl) {
      if (this.element.getAttr('tabindex') === null) {
        this.element.tabIndex = -1;
      }
      tabIndexEl = this.element;
    }

    this.element.addEventListener('focusin', () => {
      this.forceBlurValidatorEl();
    });
    this.element.addEventListener('click', () => {
      tabIndexEl.focus();
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
    this._validatorEl.dispatchEvent(new Event('blur'));
  }

  private isElementOrDescendantActive(): boolean {
    return this.element.contains(activeDocument.activeElement);
  }
}

class ValidatorElementWrapper implements ValidatorComponent {
  public constructor(public readonly validatorEl: ValidatorElement) {}
}

/**
 * Gets a validator component related to the given object.
 *
 * @param $unknown - Any object.
 * @returns The related validator component or `null` if no related validator component is found.
 */
export function getValidatorComponent($unknown: unknown): null | ValidatorComponent {
  if (isValidatorComponent($unknown)) {
    return $unknown;
  }

  if ($unknown instanceof ColorComponent) {
    return new ValidatorElementWrapper($unknown.colorPickerEl);
  }

  if ($unknown instanceof DropdownComponent) {
    return new ValidatorElementWrapper($unknown.selectEl);
  }

  if ($unknown instanceof ProgressBarComponent) {
    return new OverlayValidatorComponent($unknown.progressBar);
  }

  if ($unknown instanceof SearchComponent) {
    return new ValidatorElementWrapper($unknown.inputEl);
  }

  if ($unknown instanceof SliderComponent) {
    return new ValidatorElementWrapper($unknown.sliderEl);
  }

  if ($unknown instanceof TextAreaComponent) {
    return new ValidatorElementWrapper($unknown.inputEl);
  }

  if ($unknown instanceof TextComponent) {
    return new ValidatorElementWrapper($unknown.inputEl);
  }

  if ($unknown instanceof ToggleComponent) {
    return new OverlayValidatorComponent($unknown.toggleEl);
  }

  return null;
}

function isValidatorComponent($unknown: unknown): $unknown is ValidatorComponent {
  return typeof $unknown === 'object' && $unknown !== null && 'validatorEl' in $unknown && !!($unknown as Partial<ValidatorComponent>).validatorEl;
}
