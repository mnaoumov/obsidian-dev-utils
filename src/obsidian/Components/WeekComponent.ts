/**
 * @packageDocumentation WeekComponent
 * Contains a component that displays and edits a week.
 */

import moment from 'moment';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { initPluginContext } from '../Plugin/PluginContext.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SettingEx } from '../SettingEx.ts';

import { CssClass } from '../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

const DATE_FORMAT = 'YYYY-[W]WW';

/**
 * Represents an ISO 8601 week date.
 */
export interface IsoWeek {
  /**
   * The ISO 8601 week number (1-53).
   */
  weekNumber: number;
  /**
   * The year (1-9999).
   */
  year: number;
}

/**
 * A component that displays and edits a Week.
 *
 * You can add this component using {@link SettingEx.addWeek}.
 *
 * In order to add the styles for the component, use {@link initPluginContext} in your plugin's `onload()` function.
 *
 * Alternatively, you can copy styles from {@link https://github.com/mnaoumov/obsidian-dev-utils/releases/latest/download/styles.css}.
 */
export class WeekComponent extends TypedRangeTextComponent<IsoWeek> {
  /**
   * Creates a new Week component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'week', CssClass.WeekComponent);
  }

  /**
   * Converts a string to a Week.
   *
   * @param str - The string to convert.
   * @returns The week.
   */
  public override valueFromString(str: string): IsoWeek {
    const parsed = moment(str, DATE_FORMAT);

    if (!parsed.isValid()) {
      throw new Error('Invalid week');
    }

    return {
      weekNumber: parsed.isoWeek(),
      year: parsed.year()
    };
  }

  /**
   * Converts a week to a string.
   *
   * @param value - The week to convert.
   * @returns The string.
   */
  public override valueToString(value: IsoWeek): string {
    const date = moment().year(value.year).isoWeek(value.weekNumber);
    return date.format(DATE_FORMAT);
  }
}
