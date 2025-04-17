/**
 * @packageDocumentation
 *
 * Wraps an element in a setting component wrapper.
 */

import { CssClass } from '../../../CssClass.ts';
import { toPx } from '../../../HTMLElement.ts';

/**
 * Ensures that the element is wrapped in a setting component wrapper.
 *
 * @param el - The element to ensure is wrapped.
 * @returns The wrapper element.
 */
export function ensureWrapped(el: HTMLElement): HTMLDivElement {
  if (!el.parentElement) {
    throw new Error('Element must be attached to the DOM');
  }
  if (el.parentElement.classList.contains(CssClass.SettingComponentWrapper)) {
    return el.parentElement as HTMLDivElement;
  }

  const wrapper = createDiv({
    cls: [CssClass.LibraryName, CssClass.SettingComponentWrapper]
  });
  el.replaceWith(wrapper);
  wrapper.appendChild(el);

  requestAnimationFrame(() => {
    updateWrapperSize(wrapper, el.getBoundingClientRect());
  });

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === el) {
        updateWrapperSize(wrapper, entry.contentRect);
      }
    }
  });

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const removedNode of Array.from(mutation.removedNodes)) {
        if (removedNode === el) {
          resizeObserver.disconnect();
          mutationObserver.disconnect();
          return;
        }
      }
    }
  });

  resizeObserver.observe(el);
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  return wrapper;
}

function updateWrapperSize(wrapper: HTMLDivElement, rect: DOMRect): void {
  wrapper.setCssStyles({
    height: toPx(rect.height),
    width: toPx(rect.width)
  });
}
