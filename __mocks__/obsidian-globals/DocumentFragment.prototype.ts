import { ensureNonNullable } from '../../src/type-guards.ts';

export function find(this: DocumentFragment, selector: string): HTMLElement {
  return ensureNonNullable(this.querySelector(selector));
}

export function findAll(this: DocumentFragment, selector: string): HTMLElement[] {
  return Array.from(this.querySelectorAll(selector));
}
