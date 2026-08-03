/**
 * @file
 *
 * Wraps an element in a setting component wrapper.
 */

import { assertNonNullable } from '../../type-guards.ts';
import { CssClass } from '../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';

/**
 * Ensures that the element is wrapped in a setting component wrapper.
 *
 * @param element - The element to ensure is wrapped.
 * @returns The wrapper element.
 */
export function ensureWrapped(element: HTMLElement): HTMLDivElement {
  const parent = element.parentElement;
  assertNonNullable(parent, 'Element must be attached to the DOM');

  if (parent.classList.contains(CssClass.SettingComponentWrapper)) {
    return parent as HTMLDivElement;
  }

  const children = [...parent.children];
  const wrapper = createDiv();
  addPluginCssClasses(wrapper, CssClass.SettingComponentWrapper);
  for (const child of children) {
    wrapper.append(child);
  }
  parent.append(wrapper);
  return wrapper;
}
