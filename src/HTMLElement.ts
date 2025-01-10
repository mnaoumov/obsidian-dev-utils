/**
 * @packageDocumentation HTMLElement
 * Helpers for working with HTML elements.
 */

/**
 * A HTML element that can be validated.
 */
export interface ValidatorElement extends HTMLElement {
  /**
   * Reports the validity of the element.
   */
  reportValidity(): boolean;

  /**
   * Sets a custom error message on the element.
   * @param error - The error message to set on the element.
   */
  setCustomValidity(error: string): void;
}

/**
 * Appends a code block to the given DocumentFragment or HTMLElement.
 *
 * @param el - The DocumentFragment or HTMLElement to append the code block to.
 * @param code - The code to be displayed in the code block.
 */
export function appendCodeBlock(el: DocumentFragment | HTMLElement, code: string): void {
  el.createEl('strong', { cls: 'markdown-rendered code' }, (strong) => {
    strong.createEl('code', { text: code });
  });
}
