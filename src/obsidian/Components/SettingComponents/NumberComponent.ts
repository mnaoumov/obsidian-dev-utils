/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a number.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../../SettingEx.ts';
import type { TextBasedComponent } from './TextBasedComponent.ts';

import { CssClass } from '../../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

/**
 * A component that displays and edits a number.
 *
 * You can add this component using {@link SettingEx.addNumber}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class NumberComponent extends TypedRangeTextComponent<number> implements TextBasedComponent<number> {
  /**
   * Creates a new number component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'number', CssClass.NumberComponent);
  }

  /**
   * Empties the component.
   */
  public empty(): void {
    this.textComponent.setValue('');
  }

  /**
   * Checks if the component is empty.
   *
   * @returns `true` if the component is empty, `false` otherwise.
   */
  public isEmpty(): boolean {
    return this.textComponent.getValue() === '';
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
   * Sets the placeholder value of the component.
   *
   * @param placeholderValue - The placeholder value to set.
   * @returns The component.
   */
  public setPlaceholderValue(placeholderValue: number): this {
    this.textComponent.setPlaceholder(this.valueToString(placeholderValue));
    return this;
  }

  /**
   * Converts a string to a number.
   *
   * @param str - The string to convert.
   * @returns The number.
   */
  public override valueFromString(str: string): number {
    return parseInt(str, 10);
  }
}
