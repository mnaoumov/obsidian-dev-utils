/**
 * @packageDocumentation MultipleTextComponent
 * Contains a component that displays and edits multiple text values.
 */

import {
  TextAreaComponent,
  ValueComponent
} from 'obsidian';

import type { MaybePromise } from '../../Async.ts';
import type { ValidatorElement } from '../../HTMLElement.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../SettingEx.ts';
import type { ValidatorComponent } from './ValidatorComponent.ts';
import type { ValueComponentWithChangeTracking } from './ValueComponentWithChangeTracking.ts';

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';

/**
 * A component that displays and edits multiple text values.
 *
 * You can add this component using {@link SettingEx.addMultipleText}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class MultipleTextComponent extends ValueComponent<string[]> implements ValidatorComponent, ValueComponentWithChangeTracking<string[]> {
  /**
   * Gets the validator element of the component.
   *
   * @returns The validator element of the component.
   */
  public get validatorEl(): ValidatorElement {
    return this.textAreaComponent.inputEl;
  }

  private readonly textAreaComponent: TextAreaComponent;

  /**
   * Creates a new multiple text component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super();
    this.textAreaComponent = new TextAreaComponent(containerEl);
    containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.MultipleTextComponent);
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): string[] {
    return this.textAreaComponent.getValue().split('\n');
  }

  /**
   * Adds a change listener to the component.
   *
   * @param callback - The callback to call when the value changes.
   * @returns The component.
   */
  public onChange(callback: (newValue: string[]) => MaybePromise<void>): this {
    this.textAreaComponent.onChange(() => callback(this.getValue()));
    return this;
  }

  /**
   * Sets the disabled state of the component.
   *
   * @param disabled - The disabled state to set.
   * @returns The component.
   */
  public override setDisabled(disabled: boolean): this {
    this.textAreaComponent.setDisabled(disabled);
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
    this.textAreaComponent.setPlaceholder(placeholder);
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public override setValue(value: string[]): this {
    this.textAreaComponent.setValue(value.join('\n'));
    return this;
  }
}
