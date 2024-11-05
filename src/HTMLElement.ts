/**
 * @packageDocumentation HTMLElement
 * Helpers for working with HTML elements.
 */

/**
 * A HTML element that can be validated.
 */
export interface ValidatorElement extends HTMLElement {
  /**
   * Sets a custom error message on the element.
   * @param error - The error message to set on the element.
   */
  setCustomValidity(error: string): void;

  /**
   * Reports the validity of the element.
   */
  reportValidity(): boolean;
}
