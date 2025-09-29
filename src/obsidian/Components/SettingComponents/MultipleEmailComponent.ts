/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits multiple email addresses.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../SettingEx.ts';

import { CssClass } from '../../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits multiple email addresses.
 *
 * You can add this component using {@link SettingEx.addMultipleEmail}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class MultipleEmailComponent extends TypedTextComponent<readonly string[]> {
  /**
   * Creates a new multiple emails component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'email', CssClass.MultipleEmailComponent);
    this.inputEl.multiple = true;
  }

  /**
   * Converts a string to an email address.
   *
   * @param str - The string to convert.
   * @returns The email address.
   */
  public override valueFromString(str: string): readonly string[] {
    return str.split(',').map((email) => email.trim());
  }

  /**
   * Converts an email address to a string.
   *
   * @param value - The email address to convert.
   * @returns The string.
   */
  public override valueToString(value: readonly string[]): string {
    return value.join(', ');
  }
}
