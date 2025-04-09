/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a multi-select dropdown.
 */

import type { Promisable } from 'type-fest';

import { ValueComponent } from 'obsidian';

import type { ValidatorElement } from '../../../HTMLElement.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../../SettingEx.ts';
import type { ValidatorComponent } from './ValidatorComponent.ts';
import type { ValueComponentWithChangeTracking } from './ValueComponentWithChangeTracking.ts';

import { CssClass } from '../../../CssClass.ts';
import { getPluginId } from '../../Plugin/PluginId.ts';
import { MultipleDropdownComponent } from './MultipleDropdownComponent.ts';

/**
 * A multi-select dropdown component.
 *
 * You can add this component using {@link SettingEx.addTypedMultipleDropdown}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 *
 * @typeParam T - The type of the value to select.
 */
export class TypedMultipleDropdownComponent<T> extends ValueComponent<readonly T[]>
  implements ValidatorComponent, ValueComponentWithChangeTracking<readonly T[]> {
  /**
   * The validator element of the component.
   *
   * @returns The validator element.
   */
  public get validatorEl(): ValidatorElement {
    return this.multipleDropdownComponent.validatorEl;
  }

  private readonly multipleDropdownComponent: MultipleDropdownComponent;
  private values: T[] = [];

  /**
   * Creates a new multiple dropdown component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super();
    this.multipleDropdownComponent = new MultipleDropdownComponent(containerEl);
    containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.TypedMultipleDropdownComponent);
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
    this.multipleDropdownComponent.addOption(index.toString(), display);
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
  public getValue(): readonly T[] {
    const indices = this.multipleDropdownComponent.getValue().map((str) => parseInt(str, 10));
    return indices.map((index) => this.values[index]).filter((value): value is T => value !== undefined);
  }

  /**
   * Sets the callback function to be called when the component is changed.
   *
   * @param callback - The callback function to be called when the component is changed.
   * @returns The component.
   */
  public onChange(callback: (value: readonly T[]) => Promisable<void>): this {
    this.multipleDropdownComponent.onChange(() => callback(this.getValue()));
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
    this.multipleDropdownComponent.setDisabled(disabled);
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public setValue(value: readonly T[]): this {
    const indices = value.map((v) => this.values.indexOf(v)).filter((index) => index !== -1);
    this.multipleDropdownComponent.setValue(indices.map((index) => index.toString()));
    return this;
  }
}
