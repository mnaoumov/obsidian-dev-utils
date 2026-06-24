/**
 * @file
 *
 * Contains a component that displays and edits a text-based value.
 */

import {
  TextComponent,
  ValueComponent
} from 'obsidian';

import type { ValidatorElement } from '../../html-element.ts';
import type { ValidatorComponent } from './validator-component.ts';
import type { ValueComponentWithChangeTracking } from './value-component-with-change-tracking.ts';

import { CssClass } from '../../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';

/**
 * The parameters for constructing a {@link TypedTextComponent}.
 */
export interface TypedTextComponentConstructorParams {
  /**
   * The container element for the component.
   */
  readonly containerEl: HTMLElement;

  /**
   * A CSS class to apply to the component.
   */
  readonly cssClass?: CssClass;

  /**
   * The type of the input element.
   */
  readonly type: string;
}

/**
 * A component that displays and edits a text-based value.
 *
 * @typeParam T - The type of the value to set.
 */
export abstract class TypedTextComponent<T> extends ValueComponent<T> implements ValidatorComponent, ValueComponentWithChangeTracking<T> {
  /**
   * An input element of the component.
   */
  public readonly inputEl: HTMLInputElement;

  /**
   * A validator element of the component.
   *
   * @returns The validator element.
   */
  public get validatorEl(): ValidatorElement {
    return this.inputEl;
  }

  /**
   * The inner text component.
   */
  protected readonly textComponent: TextComponent;

  /**
   * Creates a new typed text component.
   *
   * @param params - The parameters for the typed text component.
   */
  public constructor(params: TypedTextComponentConstructorParams) {
    super();
    this.textComponent = new TextComponent(params.containerEl);
    this.inputEl = this.textComponent.inputEl;
    this.inputEl.type = params.type;
    addPluginCssClasses(params.containerEl, params.cssClass);
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): T {
    return this.valueFromString(this.textComponent.getValue());
  }

  /**
   * Sets the callback function to be called when the component is changed.
   *
   * @param callback - The callback function to be called when the component is changed.
   * @returns The component.
   */
  public onChange(callback: (value: T) => void): this {
    /* v8 ignore start -- The inner arrow function is only invoked when the DOM input event fires. */
    this.textComponent.onChange(() => {
      callback(this.getValue());
    });
    /* v8 ignore stop */
    return this;
  }

  /**
   * Called when the component is changed.
   */
  public onChanged(): void {
    this.textComponent.onChanged();
  }

  /**
   * Sets the disabled state of the component.
   *
   * @param disabled - Whether the component is disabled.
   * @returns The component.
   */
  public override setDisabled(disabled: boolean): this {
    super.setDisabled(disabled);
    this.textComponent.setDisabled(disabled);
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public override setValue(value: T): this {
    this.textComponent.setValue(this.valueToString(value));
    return this;
  }

  /**
   * Converts a string to a value.
   *
   * @param str - The string to convert.
   * @returns The value.
   */
  public abstract valueFromString(str: string): T;

  /**
   * Converts a value to a string.
   *
   * @param value - The value to convert.
   * @returns The string.
   */
  public valueToString(value: T): string {
    return String(value);
  }
}
