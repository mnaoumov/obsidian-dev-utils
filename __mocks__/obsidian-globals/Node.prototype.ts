import type {
  DomElementInfoLike,
  SvgElementInfoLike
} from './functions.ts';

import { castTo } from '../../src/ObjectUtils.ts';
import {
  createEl as createElGlobal,
  createSvg as createSvgGlobal
} from './functions.ts';

export function appendText(this: Node, val: string): void {
  this.appendChild(document.createTextNode(val));
}

export function constructorWin(this: Node): Window {
  return (this.ownerDocument ?? document).defaultView ?? window;
}

export function createDiv(
  this: Node,
  o?: DomElementInfoLike | string,
  callback?: (el: HTMLDivElement) => void
): HTMLDivElement {
  return createEl.call(this, 'div', o, callback as never) as HTMLDivElement;
}

// Node.prototype element creation helpers.
export function createEl<K extends keyof HTMLElementTagNameMap>(
  this: Node,
  tag: K,
  o?: DomElementInfoLike | string,
  callback?: (el: HTMLElementTagNameMap[K]) => void
): HTMLElementTagNameMap[K] {
  return createElGlobal(tag, { ...(typeof o === 'string' ? { cls: o } : (o ?? {})), parent: this }, callback);
}

export function createSpan(
  this: Node,
  o?: DomElementInfoLike | string,
  callback?: (el: HTMLSpanElement) => void
): HTMLSpanElement {
  return createEl.call(this, 'span', o, callback);
}

export function createSvg<K extends keyof SVGElementTagNameMap>(
  this: Node,
  tag: K,
  o?: string | SvgElementInfoLike,
  callback?: (el: SVGElementTagNameMap[K]) => void
): SVGElementTagNameMap[K] {
  return createSvgGlobal(tag, { ...(typeof o === 'string' ? { cls: o } : (o ?? {})), parent: this }, callback);
}

export function detach(this: Node): void {
  this.parentNode?.removeChild(this);
}

export function doc(this: Node): Document {
  return this.ownerDocument ?? document;
}

export function empty(this: Node): void {
  while (this.firstChild) {
    this.removeChild(this.firstChild);
  }
}

export function indexOf(this: Node, other: Node): number {
  const parent = other.parentNode;
  if (!parent) {
    return -1;
  }
  return Array.from(parent.childNodes).indexOf(other as ChildNode);
}

export function insertAfter<T extends Node>(this: Node, node: T, child: Node | null): T {
  if (!child) {
    this.appendChild(node);
    return node;
  }
  child.parentNode?.insertBefore(node, child.nextSibling);
  return node;
}

export function instanceOf<T>(this: Node, type: new () => T): this is T {
  return this instanceof (castTo<new () => object>(type));
}

export function setChildrenInPlace(this: Node, children: Node[]): void {
  empty.call(this);
  for (const child of children) {
    this.appendChild(child);
  }
}

export function win(this: Node): Window {
  return (this.ownerDocument ?? document).defaultView ?? window;
}
