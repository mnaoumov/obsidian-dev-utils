/**
 * @packageDocumentation
 *
 * Helpers for working with HTML elements.
 */

import type { Promisable } from 'type-fest';

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
   * An error message of the element.
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
 * Creates a div asynchronously.
 *
 * @param o - The element information.
 * @param callback - The callback to call when the div is created.
 * @returns A {@link Promise} that resolves to the div.
 */
export async function createDivAsync(
  o?: DomElementInfo | string,
  callback?: (el: HTMLDivElement) => Promisable<void>
): Promise<HTMLDivElement> {
  const div = createDiv(o);
  await callback?.(div);
  return div;
}

/**
 * Creates an element asynchronously.
 *
 * @param tag - The tag name of the element to create.
 * @param o - The element information.
 * @param callback - The callback to call when the element is created.
 * @returns A {@link Promise} that resolves to the element.
 */
export async function createElAsync<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  o?: DomElementInfo | string,
  callback?: (el: HTMLElementTagNameMap[K]) => Promisable<void>
): Promise<HTMLElementTagNameMap[K]> {
  const el = createEl(tag, o);
  await callback?.(el);
  return el;
}

/**
 * Creates a DocumentFragment asynchronously.
 *
 * @param callback - The callback to call when the DocumentFragment is created.
 * @returns A {@link Promise} that resolves to the DocumentFragment.
 */
export async function createFragmentAsync(callback?: (el: DocumentFragment) => Promisable<void>): Promise<DocumentFragment> {
  const fragment = createFragment();
  await callback?.(fragment);
  return fragment;
}

/**
 * Creates a span asynchronously.
 *
 * @param o - The element information.
 * @param callback - The callback to call when the span is created.
 * @returns A {@link Promise} that resolves to the span.
 */
export async function createSpanAsync(
  o?: DomElementInfo | string,
  callback?: (el: HTMLSpanElement) => Promisable<void>
): Promise<HTMLSpanElement> {
  const span = createSpan(o);
  await callback?.(span);
  return span;
}

/**
 * Creates a svg asynchronously.
 *
 * @param tag - The tag name of the svg to create.
 * @param o - The svg information.
 * @param callback - The callback to call when the svg is created.
 * @returns A {@link Promise} that resolves to the svg.
 */
export async function createSvgAsync<K extends keyof SVGElementTagNameMap>(
  tag: K,
  // eslint-disable-next-line no-undef -- Workaround until https://github.com/obsidianmd/eslint-plugin/pull/89 is merged.
  o?: string | SvgElementInfo,
  callback?: (el: SVGElementTagNameMap[K]) => Promisable<void>
): Promise<SVGElementTagNameMap[K]> {
  const svg = createSvg(tag, o);
  await callback?.(svg);
  return svg;
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
 * Gets the z-index of the given element.
 *
 * @param el - The element to get the z-index of.
 * @returns The z-index of the element.
 */
export function getZIndex(el: Element): number {
  let el2: Element | null = el;

  while (el2) {
    const zIndexStr = getComputedStyle(el2).zIndex;
    const zIndex = Number.parseInt(zIndexStr, 10);
    if (!Number.isNaN(zIndex)) {
      return zIndex;
    }
    el2 = el2.parentElement;
  }

  return 0;
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

  const elRect = el.getBoundingClientRect();
  const parentElRect = parentEl.getBoundingClientRect();

  return (
    parentElRect.top <= elRect.top
    && elRect.bottom <= parentElRect.bottom
    && parentElRect.left <= elRect.left
    && elRect.right <= parentElRect.right
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

  let isEventTriggered = false;

  for (const ancestor of ancestors) {
    ancestor.addEventListener('scroll', callbackSmooth, { capture: true });
    ancestor.addEventListener('resize', callbackSmooth, { capture: true });
  }

  return () => {
    for (const ancestor of ancestors) {
      ancestor.removeEventListener('scroll', callbackSmooth, { capture: true });
      ancestor.removeEventListener('resize', callbackSmooth, { capture: true });
    }
  };

  function callbackSmooth(): void {
    if (isEventTriggered) {
      return;
    }

    isEventTriggered = true;

    requestAnimationFrame(() => {
      try {
        callback();
      } finally {
        isEventTriggered = false;
      }
    });
  }
}

/**
 * Converts a number to a string with 'px' appended.
 *
 * @param value - The number to convert.
 * @returns The number as a string with 'px' appended.
 */
export function toPx(value: number): string {
  return `${String(value)}px`;
}

function getLoadableElements(el: Element): Element[] {
  return Array.from(el.querySelectorAll('body, img, iframe, embed, link, object, script, style, track'));
}
