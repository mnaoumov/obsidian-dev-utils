/**
 * @packageDocumentation EmailComponent
 * Contains a component that displays and edits an email address.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../SettingEx.ts';

import { CssClass } from '../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits an email address.
 *
 * You can add this component using {@link SettingEx.addEmail}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link file://./../../../static/styles.css}.
 */
export class EmailComponent extends TypedTextComponent<string> {
  /**
   * Creates a new email component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'email', CssClass.EmailComponent);
  }

  /**
   * Converts a string to an email address.
   *
   * @param str - The string to convert.
   * @returns The email address.
   */
  public override valueFromString(str: string): string {
    return str;
  }
}
