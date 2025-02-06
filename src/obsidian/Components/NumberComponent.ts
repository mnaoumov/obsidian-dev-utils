/**
 * @packageDocumentation NumberComponent
 * Contains a component that displays and edits a number.
 */

import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits a number.
 */
export class NumberComponent extends TypedTextComponent<number> {
  /**
   * Creates a new number component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'number');
  }

  /**
   * Converts a string to a number.
   *
   * @param str - The string to convert.
   * @returns The number.
   */
  public override valueFromString(str: string): number {
    return parseInt(str, 10);
  }

  /**
   * Converts a number to a string.
   *
   * @param value - The number to convert.
   * @returns The string.
   */
  public override valueToString(value: number): string {
    return value.toString();
  }
}
