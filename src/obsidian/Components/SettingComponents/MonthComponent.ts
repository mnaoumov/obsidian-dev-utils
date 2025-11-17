/**
 * @packageDocumentation
 *
 * Contains a component that displays and edits a month.
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

const DATE_FORMAT = 'YYYY-MM';

/**
 * An ISO 8601 month.
 */
export interface IsoMonth {
  /**
   * A month (1-12).
   */
  month: number;

  /**
   * A year (1-9999).
   */
  year: number;
}

/**
 * A component that displays and edits a month.
 *
 * You can add this component using {@link SettingEx.addMonth}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class MonthComponent extends TypedRangeTextComponent<IsoMonth> {
  /**
   * Creates a new month component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'month', CssClass.MonthComponent);
  }

  /**
   * Converts a string to a month.
   *
   * @param str - The string to convert.
   * @returns The month.
   */
  public override valueFromString(str: string): IsoMonth {
    const parsed = moment(str, DATE_FORMAT);

    if (!parsed.isValid()) {
      throw new Error('Invalid month');
    }

    return {
      month: parsed.month() + 1,
      year: parsed.year()
    };
  }

  /**
   * Converts a month to a string.
   *
   * @param value - The month to convert.
   * @returns The string.
   */
  public override valueToString(value: IsoMonth): string {
    const date = moment().year(value.year).month(value.month - 1);
    return date.format(DATE_FORMAT);
  }
}
