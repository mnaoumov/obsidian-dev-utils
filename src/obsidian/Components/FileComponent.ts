/**
 * @packageDocumentation FileComponent
 * Contains a component that displays and edits a file.
 */

import { CssClass } from '../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits a file.
 */
export class FileComponent extends TypedTextComponent<File | null> {
  /**
   * Creates a new file component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'file', CssClass.FileComponent);
  }

  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  public override getValue(): File | null {
    return this.inputEl.files?.[0] ?? null;
  }

  /**
   * Converts a string to a file.
   *
   * @returns The file.
   */
  public override valueFromString(): File | null {
    return this.getValue();
  }

  /**
   * Converts a file to a string.
   *
   * @param value - The file to convert.
   * @returns The string.
   */
  public override valueToString(value: File | null): string {
    return value?.name ?? '';
  }
}
