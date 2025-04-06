/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a date.
 */

import moment from 'moment';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../SettingEx.ts';

import { CssClass } from '../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * A component that displays and edits a date.
 *
 * You can add this component using {@link SettingEx.addDate}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class DateComponent extends TypedRangeTextComponent<Date> {
  /**
   * Creates a new date component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'date', CssClass.DateComponent);
  }

  /**
   * Converts a string to a date.
   *
   * @param str - The string to convert.
   * @returns The date.
   */
  public override valueFromString(str: string): Date {
    return moment(str, DATE_FORMAT).toDate();
  }

  /**
   * Converts a date to a string.
   *
   * @param value - The date to convert.
   * @returns The string.
   */
  public override valueToString(value: Date): string {
    return moment(value).format(DATE_FORMAT);
  }
}
