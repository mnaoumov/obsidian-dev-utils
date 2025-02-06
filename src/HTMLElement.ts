/**
 * @packageDocumentation HTMLElement
 * Helpers for working with HTML elements.
 */

/**
 * A HTML element that can be validated.
 */
export interface ValidatorElement extends HTMLElement {
  /**
   * Checks the validity of the element.
   *
   * @returns True if the element is valid, false otherwise.
   */
  checkValidity(): boolean;

  /**
   * Reports the validity of the element.
   */
  reportValidity(): boolean;

  /**
   * Sets a custom error message on the element.
   * @param error - The error message to set on the element.
   */
  setCustomValidity(error: string): void;

  /**
   * The error message of the element.
   */
  readonly validationMessage: string;
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

/**
 * Ensures that the given element is loaded.
 *
 * @param el - The element to ensure is loaded.
 * @returns A promise that resolves when the element is loaded.
 */
export async function ensureLoaded(el: Element): Promise<void> {
  if (isLoaded(el)) {
    return;
  }
  if (
    el instanceof HTMLBodyElement
    || el instanceof HTMLImageElement
    || el instanceof HTMLIFrameElement
    || el instanceof HTMLEmbedElement
    || el instanceof HTMLLinkElement
    || el instanceof HTMLObjectElement
    || el instanceof HTMLStyleElement
    || el instanceof HTMLTrackElement
  ) {
    await new Promise((resolve) => {
      el.addEventListener('load', resolve);
      el.addEventListener('error', resolve);
    });
    return;
  }

  await Promise.all(getLoadableElements(el).map(ensureLoaded));
}

/**
 * Checks if the element is loaded.
 *
 * @param el - The element to check.
 * @returns True if the element is loaded, false otherwise.
 */
export function isLoaded(el: Element): boolean {
  if (el instanceof HTMLBodyElement) {
    return document.readyState === 'complete' || document.readyState === 'interactive';
  }

  if (el instanceof HTMLImageElement) {
    return el.complete && el.naturalWidth > 0;
  }

  if (el instanceof HTMLIFrameElement) {
    return !!el.contentDocument;
  }

  if (el instanceof HTMLEmbedElement) {
    return !!el.getSVGDocument();
  }

  if (el instanceof HTMLLinkElement) {
    return el.rel === 'stylesheet' ? el.sheet !== null : true;
  }

  if (el instanceof HTMLObjectElement) {
    return !!el.contentDocument || !!el.getSVGDocument();
  }

  if (el instanceof HTMLScriptElement) {
    return true;
  }

  if (el instanceof HTMLStyleElement) {
    return !!el.sheet;
  }

  if (el instanceof HTMLTrackElement) {
    const READY_STATE_LOADED = 2;
    return el.readyState === READY_STATE_LOADED;
  }

  return getLoadableElements(el).every(isLoaded);
}

function getLoadableElements(el: Element): Element[] {
  return Array.from(el.querySelectorAll('body, img, iframe, embed, link, object, script, style, track'));
}
