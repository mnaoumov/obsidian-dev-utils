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
import { onAncestorScrollOrResize } from '../../../HTMLElement.ts';

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
    if (!el.parentElement) {
      throw new Error('Element must be attached to the DOM');
    }

    this._validatorEl = el.parentElement.createEl('input', {
      attr: {
        tabindex: -1
      },
      cls: [CssClass.LibraryName, CssClass.OverlayValidator]
    });

    this._validatorEl.addEventListener('focus', () => {
      this.el.focus();
    });

    this._validatorEl.isActiveElement = this.isElementOrDescendantActive.bind(this);

    this.el.addEventListener('focusin', (evt) => {
      console.warn('focusin', evt.target);
      this.forceBlurValidatorEl();
    });
    this.el.addEventListener('click', (evt) => {
      console.warn('click', evt.target);
      this.forceBlurValidatorEl();
    });
    this.el.addEventListener('focusout', (evt) => {
      console.warn('focusout', evt.target);
      setTimeout(() => {
        if (this.isElementOrDescendantActive()) {
          return;
        }

        this.forceBlurValidatorEl();
      }, 0);
    });

    const unregisterScrollOrResizeHandlers = onAncestorScrollOrResize(this.el, this.updatePosition.bind(this));

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const removedNode of Array.from(mutation.removedNodes)) {
          if (removedNode === this._validatorEl) {
            unregisterScrollOrResizeHandlers();
            observer.disconnect();
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private forceBlurValidatorEl(): void {
    this._validatorEl.dispatchEvent(new Event('blur'));
  }

  private isElementOrDescendantActive(): boolean {
    return this.el.contains(document.activeElement);
  }

  private updatePosition(): void {
    if (!this.el.offsetParent) {
      return;
    }
    const rect = this.el.getBoundingClientRect();
    const parentRect = this.el.offsetParent.getBoundingClientRect();

    this._validatorEl.setCssStyles({
      height: toPx(rect.height),
      left: toPx(rect.left - parentRect.left + this.el.offsetParent.scrollLeft),
      top: toPx(rect.top - parentRect.top + this.el.offsetParent.scrollTop),
      width: toPx(rect.width)
    });
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

function toPx(value: number): string {
  return `${value.toString()}px`;
}
