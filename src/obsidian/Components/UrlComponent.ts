/**
 * @packageDocumentation UrlComponent
 * Contains a component that displays and edits an url.
 */

import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that displays and edits an url.
 */
export class UrlComponent extends TypedTextComponent<string> {
  /**
   * Creates a new Url component.
   *
   * @param containerEl - The container element of the component.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl, 'url');
  }

  /**
   * Converts a string to an url.
   *
   * @param str - The string to convert.
   * @returns The url.
   */
  public override valueFromString(str: string): string {
    return str;
  }
}
