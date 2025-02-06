/**
 * @packageDocumentation EmailComponent
 * Contains a component that displays and edits an email address.
 */

import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits an email address.
 */
export class EmailComponent extends TypedTextComponent<string> {
  /**
   * Creates a new email component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'email');
  }

  /**
   * Converts a string to an email address.
   *
   * @param str - The string to convert.
   * @returns The email address.
   */
  public override valueFromString(str: string): string {
    return str;
  }

  /**
   * Converts an email address to a string.
   *
   * @param value - The email address to convert.
   * @returns The string.
   */
  public override valueToString(value: string): string {
    return value;
  }
}
