import { empty } from './Node.prototype.ts';

export function addClass(this: Element, ...classes: string[]): void {
  this.classList.add(...classes);
}

export function addClasses(this: Element, classes: string[]): void {
  this.classList.add(...classes);
}

export function find(this: Element, selector: string): Element | null {
  return this.querySelector(selector);
}

export function findAll(this: Element, selector: string): HTMLElement[] {
  return Array.from(this.querySelectorAll(selector));
}

export function findAllSelf(this: Element, selector: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (this.matches(selector)) {
    out.push(this as unknown as HTMLElement);
  }
  out.push(...Array.from(this.querySelectorAll<HTMLElement>(selector)));
  return out;
}

export function getAttr(this: Element, qualifiedName: string): null | string {
  return this.getAttribute(qualifiedName);
}

export function getCssPropertyValue(this: Element, property: string, pseudoElement?: string): string {
  return window.getComputedStyle(this, pseudoElement).getPropertyValue(property);
}

export function getText(this: Element): string {
  return this.textContent;
}

export function hasClass(this: Element, cls: string): boolean {
  return this.classList.contains(cls);
}

export function isActiveElement(this: Element): boolean {
  return document.activeElement === this;
}

export function matchParent(this: Element, selector: string, lastParent?: Element): Element | null {
  let cur = this.parentElement;
  while (cur && cur !== lastParent) {
    if (cur.matches(selector)) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

export function removeClass(this: Element, ...classes: string[]): void {
  this.classList.remove(...classes);
}

export function removeClasses(this: Element, classes: string[]): void {
  this.classList.remove(...classes);
}

export function setAttr(this: Element, qualifiedName: string, value: boolean | null | number | string): void {
  if (value === null) {
    this.removeAttribute(qualifiedName);
    return;
  }
  this.setAttribute(qualifiedName, String(value));
}

export function setAttrs(this: Element, obj: Record<string, boolean | null | number | string>): void {
  for (const [k, v] of Object.entries(obj)) {
    setAttr.call(this, k, v);
  }
}

export function setText(this: Element, val: DocumentFragment | string): void {
  empty.call(this);
  if (typeof val === 'string') {
    this.textContent = val;
    return;
  }
  this.appendChild(val);
}

export function toggleClass(this: Element, classes: string | string[], value: boolean): void {
  const list = Array.isArray(classes) ? classes : [classes];
  for (const cls of list) {
    this.classList.toggle(cls, value);
  }
}
