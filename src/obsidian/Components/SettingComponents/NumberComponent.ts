/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a number.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../../SettingEx.ts';

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
export class NumberComponent extends TypedRangeTextComponent<number> {
  /**
   * Creates a new number component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'number', CssClass.NumberComponent);
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
