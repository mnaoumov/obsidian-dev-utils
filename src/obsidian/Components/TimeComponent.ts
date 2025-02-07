/**
 * @packageDocumentation TimeComponent
 * Contains a component that displays and edits a time.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../SettingEx.ts';

import { CssClass } from '../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

/**
 * A component that displays and edits a time.
 *
 * You can add this component using {@link SettingEx.addTime}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link file://./../../../static/styles.css}.
 */
export class TimeComponent extends TypedRangeTextComponent<string> {
  /**
   * Creates a new time component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'time', CssClass.TimeComponent);
  }

  /**
   * Converts a string to a time.
   *
   * @param str - The string to convert.
   * @returns The date.
   */
  public override valueFromString(str: string): string {
    return str;
  }
}
