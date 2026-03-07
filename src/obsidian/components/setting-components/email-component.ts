/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits an email address.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../plugin/plugin-context.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../setting-ex.ts';
import type { TextBasedComponent } from './text-based-component.ts';

import { CssClass } from '../../../css-class.ts';
import { TypedTextComponent } from './typed-text-component.ts';

/**
 * A component that displays and edits an email address.
 *
 * You can add this component using {@link SettingEx.addEmail}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class EmailComponent extends TypedTextComponent<string> implements TextBasedComponent<string> {
  /**
   * Creates a new email component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'email', CssClass.EmailComponent);
  }

  /**
   * Empties the component.
   */
  public empty(): void {
    this.setValue('');
  }

  /**
   * Checks if the component is empty.
   *
   * @returns `true` if the component is empty, `false` otherwise.
   */
  public isEmpty(): boolean {
    return this.getValue() === '';
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
   * Converts a string to an email address.
   *
   * @param str - The string to convert.
   * @returns The email address.
   */
  public override valueFromString(str: string): string {
    return str;
  }
}
