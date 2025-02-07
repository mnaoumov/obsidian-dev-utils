/**
 * @packageDocumentation MultipleFileComponent
 * Contains a component that displays and edits multiple files.
 */

import { CssClass } from '../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits multiple files.
 */
export class MultipleFileComponent extends TypedTextComponent<File[]> {
  /**
   * Creates a new multiple file component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'file', CssClass.MultipleFileComponent);
    this.inputEl.multiple = true;
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): File[] {
    return Array.from(this.inputEl.files ?? []);
  }

  /**
   * Converts a string to a file.
   *
   * @returns The file.
   */
  public override valueFromString(): File[] {
    return this.getValue();
  }

  /**
   * Converts a file to a string.
   *
   * @param value - The file to convert.
   * @returns The string.
   */
  public override valueToString(value: File[]): string {
    return value[0]?.name ?? '';
  }
}
