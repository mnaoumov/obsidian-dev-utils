import { castTo } from '../../src/ObjectUtils.ts';

export interface DomElementInfoLike {
  attr?: Record<string, boolean | null | number | string>;
  cls?: string | string[];
  href?: string;
  parent?: Node;
  placeholder?: string;
  prepend?: boolean;
  text?: DocumentFragment | string;
  title?: string;
  type?: string;
  value?: string;
}

export interface SvgElementInfoLike {
  attr?: Record<string, boolean | null | number | string>;
  cls?: string | string[];
  parent?: Node;
  prepend?: boolean;
}

export function ajax(_options: unknown): void {
  // Intentionally a no-op in tests.
}

export async function ajaxPromise(_options: unknown): Promise<unknown> {
  // Intentionally resolves to undefined in tests.
  return undefined;
}

export function createDiv(
  o?: DomElementInfoLike | string,
  callback?: (el: HTMLDivElement) => void
): HTMLDivElement {
  return createEl('div', o, callback);
}

export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  o?: DomElementInfoLike | string,
  callback?: (el: HTMLElementTagNameMap[K]) => void
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (typeof o === 'string') {
    el.className = o;
  } else if (o) {
    if (o.cls) {
      el.className = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls;
    }
    if (o.title !== undefined) {
      el.title = o.title;
    }
    if (o.href !== undefined) {
      el.setAttribute('href', o.href);
    }
    if (o.placeholder !== undefined) {
      castTo<{ placeholder?: string }>(el).placeholder = o.placeholder;
    }
    if (o.type !== undefined) {
      castTo<{ type?: string }>(el).type = o.type;
    }
    if (o.value !== undefined) {
      castTo<{ value?: string }>(el).value = o.value;
    }
    if (o.text !== undefined) {
      if (typeof o.text === 'string') {
        el.textContent = o.text;
      } else {
        el.appendChild(o.text);
      }
    }
    if (o.attr) {
      for (const [k, v] of Object.entries(o.attr)) {
        if (v === null) {
          el.removeAttribute(k);
        } else {
          el.setAttribute(k, String(v));
        }
      }
    }
    if (o.parent) {
      if (o.prepend) {
        o.parent.insertBefore(el, o.parent.firstChild);
      } else {
        o.parent.appendChild(el);
      }
    }
  }
  callback?.(el);
  return el;
}

export function createFragment(callback?: (el: DocumentFragment) => void): DocumentFragment {
  const frag = document.createDocumentFragment();
  callback?.(frag);
  return frag;
}

export function createSpan(
  o?: DomElementInfoLike | string,
  callback?: (el: HTMLSpanElement) => void
): HTMLSpanElement {
  return createEl('span', o, callback);
}

export function createSvg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  o?: string | SvgElementInfoLike,
  callback?: (el: SVGElementTagNameMap[K]) => void
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (typeof o === 'string') {
    el.setAttribute('class', o);
  } else if (o) {
    if (o.cls) {
      el.setAttribute('class', Array.isArray(o.cls) ? o.cls.join(' ') : o.cls);
    }
    if (o.attr) {
      for (const [k, v] of Object.entries(o.attr)) {
        if (v === null) {
          el.removeAttribute(k);
        } else {
          el.setAttribute(k, String(v));
        }
      }
    }
    if (o.parent) {
      if (o.prepend) {
        o.parent.insertBefore(el, o.parent.firstChild);
      } else {
        o.parent.appendChild(el);
      }
    }
  }
  callback?.(el);
  return el;
}

export function fish(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

export function fishAll(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(selector));
}

export function isBoolean(obj: unknown): obj is boolean {
  return typeof obj === 'boolean';
}

export function nextFrame(): Promise<void> {
  return Promise.resolve();
}

export function ready(fn: () => unknown): void {
  fn();
}

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve): void => {
    setTimeout(resolve, ms);
  });
}
