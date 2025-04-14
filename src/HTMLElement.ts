/**
 * @packageDocumentation
 *
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
   *
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
 * @returns A {@link Promise} that resolves when the element is loaded.
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
 * Checks if the element is visible in the offset parent.
 *
 * @param el - The element to check.
 * @returns True if the element is visible in the offset parent, false otherwise.
 */
export function isElementVisibleInOffsetParent(el: HTMLElement): boolean {
  const parentEl = el.offsetParent;
  if (!parentEl) {
    return false;
  }

  const visibleTop = parentEl.scrollTop;
  const visibleLeft = parentEl.scrollLeft;
  const visibleBottom = visibleTop + parentEl.clientHeight;
  const visibleRight = visibleLeft + parentEl.clientWidth;

  const elTop = el.offsetTop;
  const elLeft = el.offsetLeft;
  const elBottom = elTop + el.offsetHeight;
  const elRight = elLeft + el.offsetWidth;

  return (
    visibleTop <= elTop
    && elBottom <= visibleBottom
    && visibleLeft <= elLeft
    && elRight <= visibleRight
  );
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

/**
 * Adds an event listener to the ancestor nodes of the given node.
 *
 * @param node - The node to add the event listener to.
 * @param callback - The callback to call when the event is triggered.
 * @returns A function to remove the event listener.
 */
export function onAncestorScrollOrResize(node: Node, callback: () => void): () => void {
  const ancestors: EventTarget[] = [];
  ancestors.push(document);
  ancestors.push(window);

  let currentNode: Node | null = node;

  while (currentNode) {
    ancestors.push(currentNode);
    currentNode = currentNode.parentNode;
  }

  for (const ancestor of ancestors) {
    ancestor.addEventListener('scroll', callback, { capture: true });
    ancestor.addEventListener('resize', callback, { capture: true });
  }

  return () => {
    for (const ancestor of ancestors) {
      ancestor.removeEventListener('scroll', callback, { capture: true });
      ancestor.removeEventListener('resize', callback, { capture: true });
    }
  };
}

function getLoadableElements(el: Element): Element[] {
  return Array.from(el.querySelectorAll('body, img, iframe, embed, link, object, script, style, track'));
}
