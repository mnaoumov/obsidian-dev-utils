/**
 * @packageDocumentation MonthComponent
 * Contains a component that displays and edits a month.
 */

import moment from 'moment';

import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

const DATE_FORMAT = 'YYYY-MM';

/**
 * An ISO 8601 month.
 */
export interface IsoMonth {
  /**
   * The month.
   */
  month: number;
  /**
   * The year.
   */
  year: number;
}

/**
 * A component that displays and edits a month.
 */
export class MonthComponent extends TypedRangeTextComponent<IsoMonth> {
  /**
   * Creates a new month component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'month');
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
      month: parsed.month(),
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
    const date = moment().year(value.year).month(value.month);
    return date.format(DATE_FORMAT);
  }
}
