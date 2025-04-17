/**
 * @packageDocumentation
 *
 * Wraps an element in a setting component wrapper.
 */

import { CssClass } from '../../../CssClass.ts';

/**
 * Ensures that the element is wrapped in a setting component wrapper.
 *
 * @param el - The element to ensure is wrapped.
 * @returns The wrapper element.
 */
export function ensureWrapped(el: HTMLElement): HTMLDivElement {
  const parent = el.parentElement;

  if (!parent) {
    throw new Error('Element must be attached to the DOM');
  }
  if (parent.classList.contains(CssClass.SettingComponentWrapper)) {
    return parent as HTMLDivElement;
  }

  const children = Array.from(parent.children);
  const wrapper = createDiv({
    cls: [CssClass.LibraryName, CssClass.SettingComponentWrapper]
  });
  for (const child of children) {
    wrapper.appendChild(child);
  }
  parent.appendChild(wrapper);
  return wrapper;
}
