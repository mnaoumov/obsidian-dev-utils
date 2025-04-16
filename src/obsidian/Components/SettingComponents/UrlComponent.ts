/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits an url.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../../SettingEx.ts';
import type { TextBasedComponent } from './TextBasedComponent.ts';

import { CssClass } from '../../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits an url.
 *
 * You can add this component using {@link SettingEx.addUrl}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class UrlComponent extends TypedTextComponent<string> implements TextBasedComponent<string> {
  /**
   * Creates a new Url component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'url', CssClass.UrlComponent);
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
   * Converts a string to an url.
   *
   * @param str - The string to convert.
   * @returns The url.
   */
  public override valueFromString(str: string): string {
    return str;
  }
}
