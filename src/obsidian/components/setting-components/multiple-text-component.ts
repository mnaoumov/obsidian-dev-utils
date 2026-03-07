/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits multiple text values.
 */

import type { Promisable } from 'type-fest';

import {
  TextAreaComponent,
  ValueComponent
} from 'obsidian';

import type { ValidatorElement } from '../../../html-element.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../plugin/plugin-context.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../setting-ex.ts';
import type { TextBasedComponent } from './text-based-component.ts';
import type { ValidatorComponent } from './validator-component.ts';
import type { ValueComponentWithChangeTracking } from './value-component-with-change-tracking.ts';

import { CssClass } from '../../../css-class.ts';
import { addPluginCssClasses } from '../../plugin/plugin-context.ts';

/**
 * A component that displays and edits multiple text values.
 *
 * You can add this component using {@link SettingEx.addMultipleText}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class MultipleTextComponent extends ValueComponent<readonly string[]>
  implements TextBasedComponent<readonly string[]>, ValidatorComponent, ValueComponentWithChangeTracking<readonly string[]> {
  /**
   * An input element of the component.
   *
   * @returns The input element of the component.
   */
  public get inputEl(): HTMLTextAreaElement {
    return this.textAreaComponent.inputEl;
  }

  /**
   * Gets the validator element of the component.
   *
   * @returns The validator element of the component.
   */
  public get validatorEl(): ValidatorElement {
    return this.inputEl;
  }

  private simulateChangeCallback?: () => void;

  private readonly textAreaComponent: TextAreaComponent;

  /**
   * Creates a new multiple text component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super();
    this.textAreaComponent = new TextAreaComponent(containerEl);
    addPluginCssClasses(containerEl, CssClass.MultipleTextComponent);
  }

  /**
   * Empties the component.
   */
  public empty(): void {
    this.textAreaComponent.setValue('');
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): readonly string[] {
    return this.textAreaComponent.getValue().split('\n');
  }

  /**
   * Checks if the component is empty.
   *
   * @returns `true` if the component is empty, `false` otherwise.
   */
  public isEmpty(): boolean {
    return this.textAreaComponent.getValue() === '';
  }

  /**
   * Adds a change listener to the component.
   *
   * @param callback - The callback to call when the value changes.
   * @returns The component.
   */
  public onChange(callback: (newValue: readonly string[]) => Promisable<void>): this {
    const changeHandler = (): void => {
      callback(this.getValue());
    };
    this.simulateChangeCallback = changeHandler;
    this.textAreaComponent.onChange(changeHandler);
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
    this.textAreaComponent.setDisabled(disabled);
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
   * Sets the placeholder value of the component.
   *
   * @param placeholderValue - The placeholder value to set.
   * @returns The component.
   */
  public setPlaceholderValue(placeholderValue: readonly string[]): this {
    this.setPlaceholder(this.valueToString(placeholderValue));
    return this;
  }

  /**
   * Sets the value of the component.
   *
   * @param value - The value to set.
   * @returns The component.
   */
  public override setValue(value: readonly string[]): this {
    this.textAreaComponent.setValue(this.valueToString(value));
    return this;
  }

  /**
   * @deprecated Use only from tests to simulate a change event.
   */
  public simulateChange(): void {
    this.simulateChangeCallback?.();
  }

  private valueToString(value: readonly string[]): string {
    return value.join('\n');
  }
}
