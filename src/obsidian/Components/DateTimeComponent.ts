/**
 * @packageDocumentation DateTimeComponent
 * Contains a component that displays and edits a date and time.
 */

import moment from 'moment';

import { CssClass } from '../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

/**
 * A component that displays and edits a date and time.
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
