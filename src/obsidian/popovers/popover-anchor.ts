/**
 * @file
 *
 * The resolved position a popover is placed at.
 *
 * A popover takes a resolved anchor rather than an element because callers know the position in
 * different ways: a clicked element has a rect, a context menu has the pointer that opened it, and a
 * keyboard-invoked command has the caret. Each way gets its own builder here, so the popover itself
 * stays unaware of how the position was found.
 *
 * This lives apart from the popover shell so that anything producing an anchor — most notably
 * `PointerPositionComponent` — depends only on the position, not on the panel that consumes it.
 */

import { getDocumentWindow } from '../../html-element.ts';

/**
 * The fraction of the window used to place a centered anchor.
 */
const CENTER_FRACTION = 0.5;

/**
 * Where a popover is placed: viewport coordinates plus the document they belong to.
 *
 * Carrying the document explicitly is what makes an anchor inside a pop-out window work — the popover
 * is appended to, and clamped against, that window rather than the main one.
 */
export interface PopoverAnchor {
  /**
   * The viewport `y` coordinate the popover is placed below.
   */
  readonly bottom: number;

  /**
   * The document the coordinates belong to.
   */
  readonly doc: Document;

  /**
   * The viewport `x` coordinate the popover is aligned to.
   */
  readonly left: number;
}

/**
 * Anchors a popover in the middle of the document, for the cases where nothing better is known.
 *
 * @param doc - The document to anchor in.
 * @returns The anchor.
 */
export function createAnchorFromDocumentCenter(doc: Document): PopoverAnchor {
  const win = getDocumentWindow(doc);
  return {
    bottom: win.innerHeight * CENTER_FRACTION,
    doc,
    left: win.innerWidth * CENTER_FRACTION
  };
}

/**
 * Anchors a popover just below an element — used for a clicked element, whose rect is exactly where
 * the user is looking.
 *
 * @param el - The element to anchor at.
 * @returns The anchor.
 */
export function createAnchorFromElement(el: HTMLElement): PopoverAnchor {
  const rect = el.getBoundingClientRect();
  return {
    bottom: rect.bottom,
    doc: el.ownerDocument,
    left: rect.left
  };
}

/**
 * Anchors a popover at a pointer position — used for a context menu, which is raised by a right-click
 * or a long-press whose coordinates are where the user is looking.
 *
 * @param x - The viewport `x` coordinate.
 * @param y - The viewport `y` coordinate.
 * @param doc - The document the coordinates belong to.
 * @returns The anchor.
 */
export function createAnchorFromPoint(x: number, y: number, doc: Document): PopoverAnchor {
  return {
    bottom: y,
    doc,
    left: x
  };
}

/**
 * Anchors a popover at the caret — used by a command invoked from the keyboard, with the cursor
 * already at the place being edited.
 *
 * @param doc - The document holding the selection.
 * @returns The anchor, or a centered one when there is no caret to read.
 */
export function createAnchorFromSelection(doc: Document): PopoverAnchor {
  const selection = doc.getSelection();
  const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
  if (!rect || (rect.bottom === 0 && rect.left === 0)) {
    return createAnchorFromDocumentCenter(doc);
  }

  return {
    bottom: rect.bottom,
    doc,
    left: rect.left
  };
}
