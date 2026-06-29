/**
 * @file
 *
 * Obsidian-runtime-agnostic helpers for working with HTML elements (standard DOM only).
 * Helpers that rely on the Obsidian runtime live in `src/obsidian/html-element.ts`.
 */

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
 * Converts a number to a string with 'px' appended.
 *
 * @param value - The number to convert.
 * @returns The number as a string with 'px' appended.
 */
export function toPx(value: number): string {
  return `${String(value)}px`;
}
