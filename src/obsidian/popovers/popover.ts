/**
 * @file
 *
 * A small floating panel anchored at a point, collecting a value and resolving a promise with it.
 *
 * This is the popover counterpart of `modals/modal.ts`: the same "ask the user for a value, resolve a
 * promise" shape, for the cases a modal cannot serve. A modal dims the screen and is positioned by
 * Obsidian, neither of which suits an editor that must appear *at* the thing it edits — a clicked
 * link, the caret, or wherever a context menu was raised.
 *
 * The panel rides Obsidian's `.menu` class for its background, border and shadow, so only layout is
 * styled by this library.
 */

import { Setting } from 'obsidian';

import type { PopoverAnchor } from './popover-anchor.ts';

import { getDocumentWindow } from '../../html-element.ts';
import { CssClass } from '../css-class.ts';
import { t } from '../i18n/i18n.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';

/**
 * The gap in pixels between the anchor and the popover.
 */
const ANCHOR_GAP_IN_PIXELS = 4;

/**
 * The minimum gap in pixels the popover keeps from the edges of the window when it has to be clamped
 * back into view.
 */
const VIEWPORT_MARGIN_IN_PIXELS = 8;

/**
 * Reads the value the popover resolves with when it is confirmed.
 *
 * @typeParam Value - The type of the value resolved by the popover.
 * @returns The current value.
 */
export type PopoverValueGetter<Value> = (this: void) => Value;

/**
 * The tools handed to {@link ShowPopoverParams.build} for populating a popover.
 */
export interface ShowPopoverBuildParams {
  /**
   * Dismisses the popover, resolving it with `null`, as the Cancel button does.
   */
  cancel(this: void): void;

  /**
   * Confirms the popover, resolving it with the built value, as the OK button does.
   */
  confirm(this: void): void;

  /**
   * The element to add the popover's content to. The OK and Cancel buttons are appended after it.
   */
  readonly contentEl: HTMLElement;
}

/**
 * Parameters for {@link showPopover}.
 *
 * @typeParam Value - The type of the value resolved by the popover.
 */
export interface ShowPopoverParams<Value> {
  /**
   * Where to place the popover.
   */
  readonly anchor: PopoverAnchor;

  /**
   * Populates the popover's content.
   *
   * @param params - The tools for populating the popover.
   * @returns A getter read when the popover is confirmed.
   */
  build(this: void, params: ShowPopoverBuildParams): PopoverValueGetter<Value>;

  /**
   * A text for the "Cancel" button.
   */
  readonly cancelButtonText?: string;

  /**
   * Additional CSS classes to apply to the popover.
   */
  readonly cssClasses?: string[];

  /**
   * A text for the "OK" button.
   */
  readonly okButtonText?: string;
}

/**
 * Displays a popover at the given anchor and resolves with the built value, or `null` if it was
 * dismissed without confirming.
 *
 * @typeParam Value - The type of the value resolved by the popover.
 * @param params - The parameters for the popover.
 * @returns A {@link Promise} that resolves with the built value, or `null` if dismissed.
 */
export async function showPopover<Value>(params: ShowPopoverParams<Value>): Promise<null | Value> {
  const {
    anchor,
    build,
    cancelButtonText,
    cssClasses,
    okButtonText
  } = params;

  const doc = anchor.doc;
  const win = getDocumentWindow(doc);
  const popoverElement = doc.body.createDiv({ cls: 'menu' });
  addPluginCssClasses(popoverElement, [CssClass.Popover, ...cssClasses ?? []]);

  return await new Promise<null | Value>((resolve) => {
    const state = { isClosed: false };

    function close(result: null | Value): void {
      if (state.isClosed) {
        return;
      }
      state.isClosed = true;
      doc.removeEventListener('pointerdown', handlePointerDown, true);
      popoverElement.remove();
      resolve(result);
    }

    function handleCancel(): void {
      close(null);
    }

    function handleOk(): void {
      close(getValue());
    }

    /**
     * Dismisses the popover when the next gesture starts outside it. Listening for `pointerdown`
     * rather than `click` matters: a popover is typically opened from a `click` handler, and the very
     * same click would otherwise reach this listener and close the popover the instant it appears.
     *
     * @param evt - The pointer event.
     */
    function handlePointerDown(evt: PointerEvent): void {
      if (evt.composedPath().includes(popoverElement)) {
        return;
      }
      close(null);
    }

    const getValue = build({
      cancel: handleCancel,
      confirm: handleOk,
      contentEl: popoverElement
    });

    popoverElement.addEventListener('keydown', ($event: KeyboardEvent) => {
      if ($event.key === 'Enter') {
        $event.preventDefault();
        handleOk();
        return;
      }

      if ($event.key === 'Escape') {
        $event.preventDefault();
        handleCancel();
      }
    });

    const buttonsSetting = new Setting(popoverElement);
    buttonsSetting.addButton((button) => {
      button
        .setButtonText(okButtonText ?? t(($) => $.obsidianDevUtils.buttons.ok))
        .setCta()
        .setClass(CssClass.OkButton)
        .onClick(handleOk);
    });
    buttonsSetting.addButton((button) => {
      button
        .setButtonText(cancelButtonText ?? t(($) => $.obsidianDevUtils.buttons.cancel))
        .setClass(CssClass.CancelButton)
        .onClick(handleCancel);
    });

    doc.addEventListener('pointerdown', handlePointerDown, { capture: true });
    positionAtAnchor(popoverElement, anchor, win);
    focusFirstInput(popoverElement);
  });
}

/**
 * Focuses and selects the popover's first text input, so the user can type straight away.
 *
 * @param popoverEl - The popover to focus within.
 */
function focusFirstInput(popoverEl: HTMLElement): void {
  const inputElement = popoverEl.querySelector('input');
  if (!inputElement) {
    return;
  }

  inputElement.focus();
  inputElement.select();
}

/**
 * Places the popover just below the anchor, pulling it back inside the window when it would otherwise
 * overflow — an anchor near the right or bottom edge is exactly where an unclamped popover would
 * render off-screen.
 *
 * @param popoverEl - The popover to position.
 * @param anchor - Where the popover belongs.
 * @param win - The window the anchor lives in (a pop-out window has its own).
 */
function positionAtAnchor(popoverEl: HTMLElement, anchor: PopoverAnchor, win: Window): void {
  const maxLeft = Math.max(VIEWPORT_MARGIN_IN_PIXELS, win.innerWidth - popoverEl.offsetWidth - VIEWPORT_MARGIN_IN_PIXELS);
  const maxTop = Math.max(VIEWPORT_MARGIN_IN_PIXELS, win.innerHeight - popoverEl.offsetHeight - VIEWPORT_MARGIN_IN_PIXELS);

  const left = Math.min(Math.max(anchor.left, VIEWPORT_MARGIN_IN_PIXELS), maxLeft);
  const top = Math.min(Math.max(anchor.bottom + ANCHOR_GAP_IN_PIXELS, VIEWPORT_MARGIN_IN_PIXELS), maxTop);

  popoverEl.style.left = `${String(Math.round(left + win.scrollX))}px`;
  popoverEl.style.top = `${String(Math.round(top + win.scrollY))}px`;
}
