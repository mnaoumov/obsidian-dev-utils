/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a date and time.
 */

import { moment as moment_ } from 'obsidian';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `initPluginContext` to use it in the tsdocs.
import type { initPluginContext } from '../../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- We need to import `SettingEx` to use it in the tsdocs.
import type { SettingEx } from '../../SettingEx.ts';

import { CssClass } from '../../../CssClass.ts';
import { extractDefaultExportInterop } from '../../../ObjectUtils.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

const moment = extractDefaultExportInterop(moment_);

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

/**
 * A component that displays and edits a date and time.
 *
 * You can add this component using {@link SettingEx.addDateTime}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class DateTimeComponent extends TypedRangeTextComponent<Date> {
  /**
   * Creates a new date and time component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'datetime-local', CssClass.DateTimeComponent);
  }

  /**
   * Converts a string to a date.
   *
   * @param str - The string to convert.
   * @returns The date.
   */
  public override valueFromString(str: string): Date {
    return moment(str, DATE_TIME_FORMAT).toDate();
  }

  /**
   * Converts a date to a string.
   *
   * @param value - The date to convert.
   * @returns The string.
   */
  public override valueToString(value: Date): string {
    return moment(value).format(DATE_TIME_FORMAT);
  }
}
