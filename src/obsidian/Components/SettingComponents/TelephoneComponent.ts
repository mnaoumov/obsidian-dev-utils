/**
 * @packageDocumentation
 *
 * Contains a component that allows the user to enter a telephone number.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../SettingEx.ts';
import type { TextBasedComponent } from './TextBasedComponent.ts';

import { CssClass } from '../../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that allows the user to enter a telephone number.
 *
 * It looks like regular text component on desktop but changes keyboard to digits only on mobile.
 *
 * You can add this component using {@link SettingEx.addTelephone}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class TelephoneComponent extends TypedTextComponent<string> implements TextBasedComponent<string> {
  /**
   * Creates a new telephone component.
   *
   * @param container - The container element of the component.
   */
  public constructor(container: HTMLElement) {
    super(container, 'tel', CssClass.TelephoneComponent);
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
   * Sets the placeholder value of the component.
   *
   * @param placeholderValue - The placeholder value to set.
   * @returns The component.
   */
  public setPlaceholderValue(placeholderValue: string): this {
    this.textComponent.setPlaceholder(placeholderValue);
    return this;
  }

  /**
   * Gets the value from a string.
   *
   * @param str - The string to get the value from.
   * @returns The value from the string.
   */
  public override valueFromString(str: string): string {
    return str;
  }
}
