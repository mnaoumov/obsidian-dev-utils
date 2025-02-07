/**
 * @packageDocumentation NumberComponent
 * Contains a component that displays and edits a number.
 */

import { CssClass } from '../../CssClass.ts';
import { TypedRangeTextComponent } from './TypedRangeTextComponent.ts';

/**
 * A component that displays and edits a number.
 */
export class NumberComponent extends TypedRangeTextComponent<number> {
  /**
   * Creates a new number component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'number', CssClass.NumberComponent);
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
}
