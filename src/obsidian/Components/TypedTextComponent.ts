/**
 * @packageDocumentation TypedTextComponent
 * Contains a component that displays and edits a text-based value.
 */

import type { Promisable } from 'type-fest';

import {
  TextComponent,
  ValueComponent
} from 'obsidian';

import type { ValidatorElement } from '../../HTMLElement.ts';
import type { PlaceholderComponent } from './PlaceholderComponent.ts';
import type { ValidatorComponent } from './ValidatorComponent.ts';
import type { ValueComponentWithChangeTracking } from './ValueComponentWithChangeTracking.ts';

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';

/**
 * A component that displays and edits a text-based value.
 */
export abstract class TypedTextComponent<T> extends ValueComponent<T> implements PlaceholderComponent, ValidatorComponent, ValueComponentWithChangeTracking<T> {
  /**
   * The input element of the component.
   */
  public readonly inputEl: HTMLInputElement;
  /**
   * The validator element of the component.
   */
  public get validatorEl(): ValidatorElement {
    return this.inputEl;
  }

  private readonly textComponent: TextComponent;

  /**
   * Creates a new typed text component.
   *
   * @param containerEl - The container element of the component.
   * @param type - The type of the input element.
   * @param cssClass - The CSS class of the component.
   */
  public constructor(containerEl: HTMLElement, type: string, cssClass: CssClass) {
    super();
    this.textComponent = new TextComponent(containerEl);
    this.inputEl = this.textComponent.inputEl;
    this.inputEl.type = type;
    containerEl.addClass(CssClass.LibraryName, getPluginId(), cssClass);
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): T {
    return this.valueFromString(this.inputEl.value);
  }

  /**
   * Sets the callback function to be called when the component is changed.
   *
   * @param callback - The callback function to be called when the component is changed.
   * @returns The component.
   */
  public onChange(callback: (value: T) => Promisable<void>): this {
    this.textComponent.onChange(() => callback(this.getValue()));
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
    this.textComponent.setDisabled(disabled);
    this.disabled = disabled;
    return this;
  }

  /**
   * Sets the placeholder of the component.
   *
   * @param placeholder - The placeholder to set.
   * @returns The component.
   */
  public setPlaceholder(placeholder: string): this {
    this.textComponent.setPlaceholder(placeholder);
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public override setValue(value: T): this {
    this.inputEl.value = this.valueToString(value);
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
