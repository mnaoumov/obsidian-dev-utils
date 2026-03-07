/**
 * @packageDocumentation
 *
 * Contains a component that allows the user to enter a password.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../plugin/plugin-context.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../setting-ex.ts';

import { CssClass } from '../../../css-class.ts';
import { TypedTextComponent } from './typed-text-component.ts';

/**
 * A component that allows the user to enter a password.
 *
 * You can add this component using {@link SettingEx.addPassword}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class PasswordComponent extends TypedTextComponent<string> {
  /**
   * Creates a new password component.
   *
   * @param container - The container element of the component.
   */
  public constructor(container: HTMLElement) {
    super(container, 'password', CssClass.PasswordComponent);
  }

  /**
   * Sets the placeholder value of the component.
   *
   * @param placeholder - The placeholder to set.
   * @returns The component.
   */
  public setPlaceholder(placeholder: string): this {
    this.textComponent.setPlaceholder(placeholder);
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
