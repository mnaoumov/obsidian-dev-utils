/**
 * @packageDocumentation NumberComponent
 * Contains a component that displays and edits a number.
 */

import moment from 'moment';

import { TypedTextComponent } from './TypedTextComponent.ts';
/**
 * A component that displays and edits a number.
 */
export class DateComponent extends TypedTextComponent<Date> {
  /**
   * Creates a new date component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement, private readonly format: string) {
    super(containerEl, 'date');
  }

  /**
   * Converts a string to a date.
   *
   * @param str - The string to convert.
   * @returns The date.
   */
  public override valueFromString(str: string): Date {
    return moment(str, this.format).toDate();
  }

  /**
   * Converts a date to a string.
   *
   * @param value - The date to convert.
   * @returns The string.
   */
  public override valueToString(value: Date): string {
    return moment(value).format(this.format);
  }
}
