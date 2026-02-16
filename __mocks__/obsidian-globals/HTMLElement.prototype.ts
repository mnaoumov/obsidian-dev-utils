import { noop } from '../../src/Function.ts';
import { ensureNonNullable } from '../../src/TypeGuards.ts';

export function find(this: HTMLElement, selector: string): HTMLElement {
  return ensureNonNullable(this.querySelector(selector));
}

export function findAll(this: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(this.querySelectorAll(selector));
}

export function findAllSelf(this: HTMLElement, selector: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (this.matches(selector)) {
    out.push(this);
  }
  out.push(...Array.from(this.querySelectorAll<HTMLElement>(selector)));
  return out;
}

export function hide(this: HTMLElement): void {
  // eslint-disable-next-line obsidianmd/no-static-styles-assignment -- DOM manipulation.
  this.style.display = 'none';
}

export function innerHeight(this: HTMLElement): number {
  return this.clientHeight;
}

export function innerWidth(this: HTMLElement): number {
  return this.clientWidth;
}

export function isShown(this: HTMLElement): boolean {
  return this.style.display !== 'none';
}

export function off(
  this: HTMLElement,
  _type: string,
  _selector: string,
  _listener: unknown,
  _options?: AddEventListenerOptions | boolean
): void {
  noop();
}

export function on(
  this: HTMLElement,
  type: string,
  _selector: string,
  listener: (this: HTMLElement, ev: Event, delegateTarget: HTMLElement) => unknown,
  options?: AddEventListenerOptions | boolean
): void {
  const that = this;
  function cb(ev: Event): void {
    listener.call(that, ev, ev.target as HTMLElement);
  }
  this.addEventListener(type, cb, options);
}

export function onClickEvent(
  this: HTMLElement,
  listener: (this: HTMLElement, ev: MouseEvent) => unknown,
  options?: AddEventListenerOptions | boolean
): void {
  const that = this;
  function onClick(ev: Event): void {
    listener.call(that, ev as MouseEvent);
  }
  this.addEventListener('click', onClick, options);
}

export function onNodeInserted(
  this: HTMLElement,
  listener: () => unknown,
  _once?: boolean
): () => void {
  // Jsdom doesn't implement real insertion observers; invoke immediately for safety.
  listener();
  return noop;
}

export function onWindowMigrated(
  this: HTMLElement,
  _listener: (win: Window) => unknown
): () => void {
  return noop;
}

export function setCssProps(this: HTMLElement, props: Record<string, string>): void {
  for (const [k, v] of Object.entries(props)) {
    this.style.setProperty(k, v);
  }
}

export function setCssStyles(this: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(this.style, styles);
}

export function show(this: HTMLElement): void {
  // eslint-disable-next-line obsidianmd/no-static-styles-assignment -- DOM manipulation.
  this.style.display = '';
}

export function toggle(this: HTMLElement, showValue: boolean): void {
  this.style.display = showValue ? '' : 'none';
}

export function toggleVisibility(this: HTMLElement, visible: boolean): void {
  this.style.visibility = visible ? 'visible' : 'hidden';
}

export function trigger(this: HTMLElement, eventType: string): void {
  this.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
}
