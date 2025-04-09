/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits multiple files.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../SettingEx.ts';

import { CssClass } from '../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits multiple files.
 *
 * You can add this component using {@link SettingEx.addMultipleFile}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class MultipleFileComponent extends TypedTextComponent<readonly File[]> {
  /**
   * Creates a new multiple file component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'file', CssClass.MultipleFileComponent);
    this.inputEl.multiple = true;
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): readonly File[] {
    return Array.from(this.inputEl.files ?? []);
  }

  /**
   * Converts a string to a file.
   *
   * @returns The file.
   */
  public override valueFromString(): readonly File[] {
    return this.getValue();
  }

  /**
   * Converts a file to a string.
   *
   * @param value - The file to convert.
   * @returns The string.
   */
  public override valueToString(value: readonly File[]): string {
    return value[0]?.name ?? '';
  }
}
