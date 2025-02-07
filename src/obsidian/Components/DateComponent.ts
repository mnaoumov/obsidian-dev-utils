/**
 * @packageDocumentation DateComponent
 * Contains a component that displays and edits a date.
 */

import moment from 'moment';

import { CssClass } from '../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * A component that displays and edits a date.
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
