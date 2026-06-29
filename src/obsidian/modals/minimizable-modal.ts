/**
 * @file
 *
 * A wrapper that makes any Obsidian {@link Modal} minimizable.
 *
 * Obsidian's {@link Modal} is blocking — while it is open the rest of the app is dimmed and
 * inert — and it cannot be minimized. {@link MinimizableModal} wraps any modal instance (plain
 * `Modal`, `FuzzySuggestModal`, the library's `ModalBase`, your own subclass, … — including modals
 * you do not own) and adds a minimize button: when minimized, the modal (and its blocking backdrop)
 * is hidden and a small floating bar with a restore button is shown instead, so the app stays fully
 * usable while a long-running operation continues in the background.
 *
 * The wrapper reuses the modal's own title (`titleEl`) as the minimized bar label, so set the title
 * the usual way (`modal.setTitle(...)`). Render arbitrary content into {@link Modal.contentEl},
 * including clickable note links produced by `renderInternalLink` from
 * `obsidian-dev-utils/obsidian/markdown`:
 *
 * ```ts
 * const modal = new MyModal(app);
 * modal.setTitle('Merging notes');
 * modal.contentEl.appendChild(await renderInternalLink({ app, pathOrAbstractFile: file }));
 *
 * const minimizable = new MinimizableModal(modal);
 * minimizable.modal.open();
 * minimizable.minimize(); // app is usable again; a floating bar offers "restore"
 * ```
 *
 * The wrapped modal can still be closed normally; the floating bar is cleaned up automatically when
 * the modal closes (even if it is closed while minimized).
 */

import type { Modal } from 'obsidian';

import { around } from 'monkey-around';
import { setIcon } from 'obsidian';

import { CssClass } from '../../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';

const MINIMIZE_ICON_ID = 'minus';
const RESTORE_ICON_ID = 'maximize-2';

/**
 * Wraps a {@link Modal} instance to make it minimizable to a small floating bar and restorable,
 * keeping the app usable while minimized.
 *
 * @typeParam TModal - The type of the wrapped modal.
 */
export class MinimizableModal<TModal extends Modal> {
  /**
   * The wrapped modal. Open, close, and populate it as usual (e.g. `minimizable.modal.open()`).
   */
  public readonly modal: TModal;

  /**
   * Whether the modal is currently minimized.
   *
   * @returns `true` if the modal is currently minimized, `false` otherwise.
   */
  public get isMinimized(): boolean {
    return this.isMinimizedValue;
  }

  private isMinimizedValue = false;
  private readonly minimizeButtonEl: HTMLElement;
  private minimizedBarEl: HTMLElement | null = null;

  /**
   * Wraps the given modal, adding a minimize button and wiring up cleanup on close.
   *
   * @param modal - The modal instance to make minimizable.
   */
  public constructor(modal: TModal) {
    this.modal = modal;
    addPluginCssClasses(modal.containerEl, [CssClass.MinimizableModal]);
    this.minimizeButtonEl = this.createMinimizeButton();
    this.patchOnClose(modal);
  }

  /**
   * Minimizes the modal: hides the modal and its backdrop and shows a floating bar with a restore
   * button. A no-op if the modal is already minimized.
   */
  public minimize(): void {
    if (this.isMinimizedValue) {
      return;
    }

    this.isMinimizedValue = true;
    this.minimizeButtonEl.hide();
    this.modal.containerEl.hide();
    // The modal stays open while minimized, so its keymap scope would otherwise stay active.
    // Obsidian's focus trap then steals focus back to the hidden modal, so the editor cannot type.
    // Popping the scope releases the trap and the `Escape` capture; `restore()` re-pushes it.
    this.modal.app.keymap.popScope(this.modal.scope);
    this.minimizedBarEl = this.createMinimizedBar();
  }

  /**
   * Restores the modal from the minimized state, removing the floating bar. A no-op if the modal is
   * not minimized.
   */
  public restore(): void {
    if (!this.isMinimizedValue) {
      return;
    }

    this.isMinimizedValue = false;
    this.removeMinimizedBar();
    // Re-push the scope popped in minimize() so the restored modal blocks the app again (focus trap
    // + Escape capture).
    this.modal.app.keymap.pushScope(this.modal.scope);
    this.modal.containerEl.show();
    this.minimizeButtonEl.show();
  }

  private createMinimizeButton(): HTMLElement {
    const buttonEl = this.modal.modalEl.createEl('button', { cls: CssClass.MinimizeButton });
    setIcon(buttonEl, MINIMIZE_ICON_ID);
    buttonEl.addEventListener('click', () => {
      this.minimize();
    });
    return buttonEl;
  }

  private createMinimizedBar(): HTMLElement {
    const barEl = this.modal.containerEl.ownerDocument.body.createDiv();
    addPluginCssClasses(barEl, [CssClass.MinimizedModalBar]);
    barEl.createSpan({
      cls: CssClass.MinimizedModalBarTitle,
      text: this.modal.titleEl.textContent
    });
    const restoreButtonEl = barEl.createEl('button', { cls: CssClass.RestoreButton });
    setIcon(restoreButtonEl, RESTORE_ICON_ID);
    restoreButtonEl.addEventListener('click', () => {
      this.restore();
    });
    return barEl;
  }

  private handleClose(): void {
    this.removeMinimizedBar();
    this.isMinimizedValue = false;
  }

  private patchOnClose(modal: Modal): void {
    around(modal, {
      onClose: (next: () => void): () => void => {
        return (): void => {
          next.call(modal);
          this.handleClose();
        };
      }
    });
  }

  private removeMinimizedBar(): void {
    this.minimizedBarEl?.remove();
    this.minimizedBarEl = null;
  }
}
