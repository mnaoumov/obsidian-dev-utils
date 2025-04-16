/**
 * @packageDocumentation
 *
 * Contains a component that allows the user to enter a password.
 */

import { CssClass } from '../../../CssClass.ts';
import { TypedTextComponent } from './TypedTextComponent.ts';

/**
 * A component that allows the user to enter a password.
 */
export class PasswordComponent extends TypedTextComponent<string> {
  /**
   * Creates a new password component.
   *
   * @param container - The container element of the component.
   */
  public constructor(container: HTMLElement) {
    super(container, 'password', CssClass.PasswordComponent);
  }

  /**
   * Sets the placeholder value of the component.
   *
   * @param placeholder - The placeholder to set.
   * @returns The component.
   */
  public setPlaceholder(placeholder: string): this {
    this.textComponent.setPlaceholder(placeholder);
    return this;
  }

  /**
   * Gets the value from a string.
   *
   * @param str - The string to get the value from.
   * @returns The value from the string.
   */
  public override valueFromString(str: string): string {
    return str;
  }
}
