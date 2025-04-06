/**
 * @packageDocumentation
 *
 * Checkbox component.
 */

import type { Promisable } from 'type-fest';

import { ValueComponent } from 'obsidian';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../SettingEx.ts';
import type { ValueComponentWithChangeTracking } from './ValueComponentWithChangeTracking.ts';

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';

/**
 * A component that displays a checkbox.
 *
 * You can add this component using {@link SettingEx.addCheckbox}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class CheckboxComponent extends ValueComponent<boolean> implements ValueComponentWithChangeTracking<boolean> {
  /**
   * The input element of the checkbox.
   */
  public readonly inputEl: HTMLInputElement;
  private changeCallback?: (newValue: boolean) => Promisable<void>;

  public constructor(containerEl: HTMLElement) {
    super();
    containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.CheckboxComponent);
    this.inputEl = containerEl.createEl('input', { type: 'checkbox' });
    this.inputEl.addEventListener('change', this.onChanged.bind(this));
  }

  /**
   * Gets the value of the checkbox.
   *
   * @returns The value of the checkbox.
   */
  public override getValue(): boolean {
    return this.inputEl.checked;
  }

  /**
   * Sets the callback to be called when the checkbox is changed.
   *
   * @param callback - The callback to be called when the checkbox is changed.
   * @returns The component.
   */
  public onChange(callback: (newValue: boolean) => Promisable<void>): this {
    this.changeCallback = callback;
    return this;
  }

  /**
   * Called when the checkbox is changed.
   */
  public onChanged(): void {
    this.changeCallback?.(this.getValue());
  }

  /**
   * Sets the disabled state of the checkbox.
   *
   * @param disabled - The disabled state of the checkbox.
   * @returns The component.
   */
  public override setDisabled(disabled: boolean): this {
    super.setDisabled(disabled);
    this.inputEl.disabled = disabled;
    return this;
  }

  /**
   * Sets the value of the checkbox.
   *
   * @param value - The value to set the checkbox to.
   * @returns The component.
   */
  public override setValue(value: boolean): this {
    this.inputEl.checked = value;
    return this;
  }
}
