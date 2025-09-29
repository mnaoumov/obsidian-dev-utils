/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a file.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../SettingEx.ts';

import { CssClass } from '../../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits a file.
 *
 * You can add this component using {@link SettingEx.addFile}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class FileComponent extends TypedTextComponent<File | null> {
  /**
   * Creates a new file component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'file', CssClass.FileComponent);
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): File | null {
    return this.inputEl.files?.[0] ?? null;
  }

  /**
   * Converts a string to a file.
   *
   * @returns The file.
   */
  public override valueFromString(): File | null {
    return this.getValue();
  }

  /**
   * Converts a file to a string.
   *
   * @param value - The file to convert.
   * @returns The string.
   */
  public override valueToString(value: File | null): string {
    return value?.name ?? '';
  }
}
