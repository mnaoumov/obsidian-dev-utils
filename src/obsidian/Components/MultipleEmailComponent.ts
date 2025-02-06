/**
 * @packageDocumentation MultipleEmailComponent
 * Contains a component that displays and edits multiple email addresses.
 */

import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits multiple email addresses.
 */
export class MultipleEmailComponent extends TypedTextComponent<string[]> {
  /**
   * Creates a new multiple emails component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'email');
    this.inputEl.multiple = true;
  }

  /**
   * Converts a string to an email address.
   *
   * @param str - The string to convert.
   * @returns The email address.
   */
  public override valueFromString(str: string): string[] {
    return str.split(',').map((email) => email.trim());
  }

  /**
   * Converts an email address to a string.
   *
   * @param value - The email address to convert.
   * @returns The string.
   */
  public override valueToString(value: string[]): string {
    return value.join(', ');
  }
}
