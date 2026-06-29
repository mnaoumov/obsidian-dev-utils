/**
 * @file
 *
 * Helpers for working with HTML elements that rely on the Obsidian runtime (its injected
 * `createEl`/`createDiv`/`createSpan`/`createSvg`/`createFragment` globals, `el.instanceOf`,
 * `activeWindow`/`activeDocument`, and `el.onNodeInserted`).
 */

import type { Promisable } from 'type-fest';

import { CallbackDisposable } from '../disposable.ts';

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
 * @typeParam K - The tag name key from `HTMLElementTagNameMap`.
 * @param tag - The tag name of the element to create.
 * @param o - The element information.
 * @param callback - The callback to call when the element is created.
 * @returns A {@link Promise} that resolves to the element.
 * @remarks Not refactored to parameter-object pattern, to keep the parity with {@link obsidian#createEl} (or createSvg, correspondingly).
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
 * @typeParam K - The tag name key from `SVGElementTagNameMap`.
 * @param tag - The tag name of the svg to create.
 * @param o - The svg information.
 * @param callback - The callback to call when the svg is created.
 * @returns A {@link Promise} that resolves to the svg.
 * @remarks Not refactored to parameter-object pattern, to keep the parity with {@link obsidian#createSvg} (or createEl, correspondingly).
 */
export async function createSvgAsync<K extends keyof SVGElementTagNameMap>(
  tag: K,
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
    el.instanceOf(HTMLBodyElement)
    || el.instanceOf(HTMLImageElement)
    || el.instanceOf(HTMLIFrameElement)
    || el.instanceOf(HTMLEmbedElement)
    || el.instanceOf(HTMLLinkElement)
    || el.instanceOf(HTMLObjectElement)
    || el.instanceOf(HTMLStyleElement)
    || el.instanceOf(HTMLTrackElement)
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
 * @returns `true` if the element is loaded, `false` otherwise.
 */
export function isLoaded(el: Element): boolean {
  if (el.instanceOf(HTMLBodyElement)) {
    return activeDocument.readyState === 'complete' || activeDocument.readyState === 'interactive';
  }

  if (el.instanceOf(HTMLImageElement)) {
    return el.complete && el.naturalWidth > 0;
  }

  if (el.instanceOf(HTMLIFrameElement)) {
    return !!el.contentDocument;
  }

  if (el.instanceOf(HTMLEmbedElement)) {
    return !!el.getSVGDocument();
  }

  if (el.instanceOf(HTMLLinkElement)) {
    return el.rel === 'stylesheet' ? el.sheet !== null : true;
  }

  if (el.instanceOf(HTMLObjectElement)) {
    return !!el.contentDocument || !!el.getSVGDocument();
  }

  if (el.instanceOf(HTMLScriptElement)) {
    return true;
  }

  if (el.instanceOf(HTMLStyleElement)) {
    return !!el.sheet;
  }

  if (el.instanceOf(HTMLTrackElement)) {
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
 * @returns A {@link Disposable} that removes the event listeners when disposed, for use with `using`.
 */
export function onAncestorScrollOrResize(node: Node, callback: () => void): Disposable {
  const ancestors: EventTarget[] = [];
  ancestors.push(activeDocument);
  ancestors.push(activeWindow);

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

  return new CallbackDisposable({
    callback: (): void => {
      for (const ancestor of ancestors) {
        ancestor.removeEventListener('scroll', callbackSmooth, { capture: true });
        ancestor.removeEventListener('resize', callbackSmooth, { capture: true });
      }
    }
  });

  function callbackSmooth(): void {
    if (isEventTriggered) {
      return;
    }

    isEventTriggered = true;

    window.requestAnimationFrame(() => {
      try {
        callback();
      } finally {
        isEventTriggered = false;
      }
    });
  }
}

/**
 * Waits until the given element is connected to the DOM.
 *
 * @param el - The element to check.
 * @returns A promise that resolves when the element is connected.
 */
export function waitUntilConnected(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    if (el.isConnected) {
      resolve();
    } else {
      el.onNodeInserted(() => {
        resolve();
      }, true);
    }
  });
}

function getLoadableElements(el: Element): Element[] {
  return Array.from(el.querySelectorAll('body, img, iframe, embed, link, object, script, style, track'));
}
