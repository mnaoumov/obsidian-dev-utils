/**
 * @packageDocumentation TimeComponent
 * Contains a component that displays and edits a time.
 */

import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

/**
 * A component that displays and edits a time.
 */
export class TimeComponent extends TypedRangeTextComponent<string> {
  /**
   * Creates a new time component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'time');
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

  /**
   * Converts a time to a string.
   *
   * @param value - The time to convert.
   * @returns The string.
   */
  public override valueToString(value: string): string {
    return value;
  }
}
