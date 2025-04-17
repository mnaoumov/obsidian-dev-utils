/**
 * @packageDocumentation
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

import type { ValidatorElement } from '../../../HTMLElement.ts';

import { CssClass } from '../../../CssClass.ts';
import { ensureWrapped } from './SettingComponentWrapper.ts';

/**
 * A component that has a validator element.
 */
export interface ValidatorComponent {
  /**
   * The validator element of the component.
   */
  readonly validatorEl: ValidatorElement;
}

class OverlayValidatorComponent implements ValidatorComponent {
  public get validatorEl(): ValidatorElement {
    return this._validatorEl;
  }

  private readonly _validatorEl: ValidatorElement;

  public constructor(private readonly el: HTMLElement) {
    const wrapper = ensureWrapped(el);

    this._validatorEl = wrapper.createEl('input', {
      attr: {
        tabindex: -1
      },
      cls: [CssClass.LibraryName, CssClass.OverlayValidator]
    });

    this._validatorEl.addEventListener('focus', () => {
      this.el.focus();
    });

    this._validatorEl.isActiveElement = this.isElementOrDescendantActive.bind(this);

    let tabIndexEl = this.el.querySelector<HTMLElement>('[tabindex]');
    if (!tabIndexEl) {
      if (this.el.getAttr('tabindex') === null) {
        this.el.tabIndex = -1;
      }
      tabIndexEl = this.el;
    }

    this.el.addEventListener('focusin', () => {
      this.forceBlurValidatorEl();
    });
    this.el.addEventListener('click', () => {
      tabIndexEl.focus();
    });
    this.el.addEventListener('focusout', () => {
      setTimeout(() => {
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
    return this.el.contains(document.activeElement);
  }
}

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

function isValidatorComponent(obj: unknown): obj is ValidatorComponent {
  return !!(obj as Partial<ValidatorComponent>).validatorEl;
}
