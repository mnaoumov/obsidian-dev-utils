/**
 * @packageDocumentation
 *
 * Typed dropdown component.
 */

import type { Promisable } from 'type-fest';

import {
  DropdownComponent,
  ValueComponent
} from 'obsidian';

import type { ValidatorElement } from '../../../HTMLElement.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../../SettingEx.ts';
import type { ValueComponentWithChangeTracking } from './ValueComponentWithChangeTracking.ts';

import { CssClass } from '../../../CssClass.ts';
import { addPluginCssClasses } from '../../Plugin/PluginContext.ts';

/**
 * A dropdown component that can be used to select a value from a list.
 *
 * You can add this component using {@link SettingEx.addTypedDropdown}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 *
 * @typeParam T - The type of the value to select.
 */
export class TypedDropdownComponent<T> extends ValueComponent<null | T> implements ValueComponentWithChangeTracking<null | T> {
  /**
   * The validator element of the component.
   *
   * @returns The validator element.
   */
  public get validatorEl(): ValidatorElement {
    return this.dropdownComponent.selectEl;
  }

  private readonly dropdownComponent: DropdownComponent;

  private values: T[] = [];

  /**
   * Creates a new multiple dropdown component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super();
    this.dropdownComponent = new DropdownComponent(containerEl);
    addPluginCssClasses(containerEl, CssClass.TypedDropdownComponent);
  }

  /**
   * Adds an option to the dropdown.
   *
   * @param value - The value of the option.
   * @param display - The display text of the option.
   * @returns The component.
   */
  public addOption(value: T, display: string): this {
    let index = this.values.indexOf(value);
    if (index === -1) {
      this.values.push(value);
      index = this.values.length - 1;
    }
    this.dropdownComponent.addOption(index.toString(), display);
    return this;
  }

  /**
   * Adds multiple options to the dropdown.
   *
   * @param options - The options to add.
   * @returns The component.
   */
  public addOptions(options: Map<T, string>): this {
    for (const [value, display] of options.entries()) {
      this.addOption(value, display);
    }
    return this;
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public getValue(): null | T {
    return this.values[this.dropdownComponent.selectEl.selectedIndex] ?? null;
  }

  /**
   * Sets the callback function to be called when the component is changed.
   *
   * @param callback - The callback function to be called when the component is changed.
   * @returns The component.
   */
  public onChange(callback: (value: null | T) => Promisable<void>): this {
    this.dropdownComponent.onChange(() => callback(this.getValue()));
    return this;
  }

  /**
   * Sets the disabled state of the component.
   *
   * @param disabled - The disabled state to set.
   * @returns The component.
   */
  public override setDisabled(disabled: boolean): this {
    super.setDisabled(disabled);
    this.dropdownComponent.setDisabled(disabled);
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public setValue(value: null | T): this {
    const index = value === null ? -1 : this.values.indexOf(value);
    this.dropdownComponent.selectEl.selectedIndex = index;
    return this;
  }
}
