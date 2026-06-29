/**
 * @file
 *
 * Obsidian-runtime-agnostic helpers for working with HTML elements.
 *
 * Several helpers here mirror behavior that the Obsidian runtime injects onto the DOM prototypes
 * (`createEl`/`createDiv`/`createSpan`/`createSvg`/`createFragment`, `Node.prototype.instanceOf`,
 * `Element.prototype.setText`/`setAttrs`). To stay independent of the Obsidian runtime, that behavior
 * is reimplemented here in standard DOM, ported from Obsidian's own implementation in
 * `obsidian.asar/enhance.js`. See the `obsidian-versions` project; revalidate the port when Obsidian
 * changes `enhance.js` (there is a reminder in `CLAUDE.md`).
 */

import type { Promisable } from 'type-fest';

import { CallbackDisposable } from './disposable.ts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * A HTML element that can be validated.
 */
export interface ValidatorElement extends HTMLElement {
  /**
   * Checks the validity of the element.
   *
   * @returns `true` if the element is valid, `false` otherwise.
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
  const div = createHtmlElement('div', o);
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
  const el = createHtmlElement(tag, o);
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
  // eslint-disable-next-line obsidianmd/prefer-active-doc -- Agnostic module: use the standard DOM `document`, not Obsidian's `activeDocument`.
  const fragment = document.createDocumentFragment();
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
  const span = createHtmlElement('span', o);
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
  const svg = createSvgElement(tag, o);
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
  const win = getNodeWindow(el);
  if (
    isInstanceOf(el, win.HTMLBodyElement)
    || isInstanceOf(el, win.HTMLImageElement)
    || isInstanceOf(el, win.HTMLIFrameElement)
    || isInstanceOf(el, win.HTMLEmbedElement)
    || isInstanceOf(el, win.HTMLLinkElement)
    || isInstanceOf(el, win.HTMLObjectElement)
    || isInstanceOf(el, win.HTMLStyleElement)
    || isInstanceOf(el, win.HTMLTrackElement)
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
 * @returns `true` if the element is visible in the offset parent, `false` otherwise.
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
 * @returns `true` if the element is loaded, `false` otherwise.
 */
export function isLoaded(el: Element): boolean {
  const win = getNodeWindow(el);

  if (isInstanceOf(el, win.HTMLBodyElement)) {
    const readyState = el.ownerDocument.readyState;
    return readyState === 'complete' || readyState === 'interactive';
  }

  if (isInstanceOf(el, win.HTMLImageElement)) {
    return el.complete && el.naturalWidth > 0;
  }

  if (isInstanceOf(el, win.HTMLIFrameElement)) {
    return !!el.contentDocument;
  }

  if (isInstanceOf(el, win.HTMLEmbedElement)) {
    return !!el.getSVGDocument();
  }

  if (isInstanceOf(el, win.HTMLLinkElement)) {
    return el.rel === 'stylesheet' ? el.sheet !== null : true;
  }

  if (isInstanceOf(el, win.HTMLObjectElement)) {
    return !!el.contentDocument || !!el.getSVGDocument();
  }

  if (isInstanceOf(el, win.HTMLScriptElement)) {
    return true;
  }

  if (isInstanceOf(el, win.HTMLStyleElement)) {
    return !!el.sheet;
  }

  if (isInstanceOf(el, win.HTMLTrackElement)) {
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
  const win = getNodeWindow(node);
  const ancestors: EventTarget[] = [];
  ancestors.push(node.ownerDocument ?? win.document);
  ancestors.push(win);

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

    win.requestAnimationFrame(() => {
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
      return;
    }

    // Obsidian's `el.onNodeInserted` uses a `node-inserted` CSS keyframe from Obsidian's stylesheet.
    // The agnostic equivalent instead observes the element's document for it becoming connected.
    const ownerDocument = el.ownerDocument;
    const observer = new (getNodeWindow(el)).MutationObserver(() => {
      if (el.isConnected) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(ownerDocument, { childList: true, subtree: true });
  });
}

/**
 * Applies the element-type-agnostic subset of {@link DomElementInfo} that Obsidian's `createEl`
 * supports — `cls`, `text`, `attr`, `title`, and `parent`/`prepend`. The element-type-specific
 * fields (`value`, `type`, `placeholder`, `href`) and the `on*` event-handler keys are intentionally
 * NOT ported (no internal caller needs them); extend this if a consumer does — and revalidate against
 * `enhance.js` (see the `@file` note and `CLAUDE.md`).
 *
 * @param el - The element to apply the info to.
 * @param o - The element info (or a bare class string).
 */
function applyDomElementInfo(el: HTMLElement, o: DomElementInfo | string | undefined): void {
  const info: DomElementInfo = typeof o === 'string' ? { cls: o } : o ?? {};

  if (info.cls !== undefined) {
    el.className = Array.isArray(info.cls) ? info.cls.join(' ') : info.cls;
  }
  if (info.text !== undefined) {
    setElementText(el, info.text);
  }
  if (info.attr) {
    setElementAttrs(el, info.attr);
  }
  if (info.title !== undefined) {
    el.title = info.title;
  }
  insertIntoParent(el, info);
}

function createHtmlElement<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomElementInfo | string): HTMLElementTagNameMap[K] {
  // eslint-disable-next-line obsidianmd/prefer-active-doc -- Agnostic module: use the standard DOM `document`, not Obsidian's `activeDocument`.
  const el = document.createElement(tag);
  applyDomElementInfo(el, o);
  return el;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tag: K, o?: string | SvgElementInfo): SVGElementTagNameMap[K] {
  // eslint-disable-next-line obsidianmd/prefer-active-doc -- Agnostic module: use the standard DOM `document`, not Obsidian's `activeDocument`.
  const svg = document.createElementNS(SVG_NAMESPACE, tag);
  const info: SvgElementInfo = typeof o === 'string' ? { cls: o } : o ?? {};

  if (info.cls !== undefined) {
    if (Array.isArray(info.cls)) {
      svg.classList.add(...info.cls);
    } else {
      svg.classList.add(info.cls);
    }
  }
  if (info.attr) {
    setElementAttrs(svg, info.attr);
  }
  insertIntoParent(svg, info);
  return svg;
}

function getLoadableElements(el: Element): Element[] {
  return Array.from(el.querySelectorAll('body, img, iframe, embed, link, object, script, style, track'));
}

// eslint-disable-next-line obsidianmd/no-global-this -- Type-only: the resolved window needs the global DOM constructor typings.
function getNodeWindow(node: Node): typeof globalThis & Window {
  return node.ownerDocument?.defaultView ?? window;
}

function insertIntoParent(el: Element, info: DomElementInfo | SvgElementInfo): void {
  if (!info.parent) {
    return;
  }
  if (info.prepend) {
    info.parent.insertBefore(el, info.parent.firstChild);
  } else {
    info.parent.appendChild(el);
  }
}

function isInstanceOf<T extends Node>(node: Node, ctor: abstract new (...args: never[]) => T): node is T {
  // Agnostic reimplementation of Obsidian's `Node.prototype.instanceOf` (enhance.js).
  // The caller resolves `ctor` in the node's own realm (via `getNodeWindow`), keeping it cross-window safe.
  // eslint-disable-next-line obsidianmd/prefer-instanceof -- This IS the agnostic `.instanceOf` replacement.
  return node instanceof ctor;
}

function setElementAttrs(el: Element, attr: NonNullable<DomElementInfo['attr']>): void {
  for (const [name, value] of Object.entries(attr)) {
    if (value === null) {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, String(value));
    }
  }
}

function setElementText(el: HTMLElement, text: DocumentFragment | string): void {
  if (text instanceof DocumentFragment) {
    el.replaceChildren(text);
  } else {
    el.textContent = text;
  }
}
