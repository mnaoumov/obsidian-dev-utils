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
        readonly: ''
      },
      cls: [CssClass.LibraryName, CssClass.OverlayValidator]
    });

    const MOUSE_POINTER_EVENT_NAMES = [
      'click',
      'mousedown',
      'mouseup',
      'dblclick',
      'mouseenter',
      'mouseleave',
      'mouseover',
      'mouseout',
      'mousemove',
      'contextmenu',
      'wheel',
      'touchstart',
      'touchmove',
      'touchend'
    ];

    for (const eventName of MOUSE_POINTER_EVENT_NAMES) {
      this._validatorEl.addEventListener(eventName, (): void => {
        this.el.trigger(eventName);
      });
    }

    let isUpdatingPosition = false;
    const that = this;

    updatePositionSmooth();

    const eventTargets = new Set<EventTarget>();
    eventTargets.add(document);
    eventTargets.add(window);

    let scrollEl: HTMLElement | null = this.el;
    while (scrollEl) {
      eventTargets.add(scrollEl);
      scrollEl = scrollEl.parentElement;
    }

    for (const element of eventTargets) {
      element.addEventListener('scroll', updatePositionSmooth);
      element.addEventListener('resize', updatePositionSmooth);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const removedNode of Array.from(mutation.removedNodes)) {
          if (removedNode === this._validatorEl) {
            for (const element of eventTargets) {
              element.removeEventListener('scroll', updatePositionSmooth);
              element.removeEventListener('resize', updatePositionSmooth);
            }

            observer.disconnect();
            break;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    function updatePositionSmooth(): void {
      if (isUpdatingPosition) {
        return;
      }

      isUpdatingPosition = true;
      requestAnimationFrame((): void => {
        that.updatePosition();
        isUpdatingPosition = false;
      });
    }
  }

  private updatePosition(): void {
    const rect = this.el.getBoundingClientRect();

    this._validatorEl.setCssStyles({
      height: `${rect.height.toString()}px`,
      left: `${(rect.left + window.scrollX).toString()}px`,
      top: `${(rect.top + window.scrollY).toString()}px`,
      width: `${rect.width.toString()}px`
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
