/**
 * @file
 *
 * A minimizable modal.
 *
 * Obsidian's {@link Modal} is blocking — while it is open the rest of the app is dimmed and
 * inert — and it cannot be minimized. {@link MinimizableModal} adds a minimize button: when
 * minimized, the modal (and its blocking backdrop) is hidden and a small floating bar with a restore
 * button is shown instead, so the app stays fully usable while a long-running operation continues in
 * the background. Calling {@link MinimizableModal.restore} (or clicking the restore button) brings
 * the modal back.
 *
 * Render arbitrary content into {@link Modal.contentEl}, including clickable note links produced by
 * `renderInternalLink` from `obsidian-dev-utils/obsidian/markdown`:
 *
 * ```ts
 * const modal = new MinimizableModal({ app, title: 'Merging notes' });
 * modal.open();
 * modal.contentEl.appendChild(await renderInternalLink({ app, pathOrAbstractFile: file }));
 * ```
 */

import {
  Modal,
  setIcon
} from 'obsidian';

import type { ModalParamsBase } from './modal.ts';

import { CssClass } from '../../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';

const MINIMIZE_ICON_ID = 'minus';
const RESTORE_ICON_ID = 'maximize-2';

/**
 * The parameters for constructing a {@link MinimizableModal}.
 */
export interface MinimizableModalConstructorParams extends ModalParamsBase {
  /**
   * The title shown in the modal header and in the minimized bar.
   */
  readonly title?: string;
}

/**
 * A modal that can be minimized to a small floating bar and restored, keeping the app usable while
 * it is minimized.
 */
export class MinimizableModal extends Modal {
  /**
   * Whether the modal is currently minimized.
   *
   * @returns `true` if the modal is currently minimized, `false` otherwise.
   */
  public get isMinimized(): boolean {
    return this.isMinimizedValue;
  }

  private isMinimizedValue = false;
  private minimizedBarEl: HTMLElement | null = null;
  private readonly title: string;

  /**
   * Creates a new minimizable modal.
   *
   * @param params - The parameters.
   */
  public constructor(params: MinimizableModalConstructorParams) {
    super(params.app);
    this.title = params.title ?? '';
    addPluginCssClasses(this.containerEl, [...(params.cssClasses ?? []), CssClass.MinimizableModal]);
    if (this.title) {
      this.setTitle(this.title);
    }
    this.createMinimizeButton();
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
    this.containerEl.hide();
    this.minimizedBarEl = this.createMinimizedBar();
  }

  /**
   * Cleans up the floating bar and minimized state when the modal is closed.
   */
  public override onClose(): void {
    super.onClose();
    this.removeMinimizedBar();
    this.isMinimizedValue = false;
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
    this.containerEl.show();
  }

  private createMinimizeButton(): void {
    const buttonEl = this.modalEl.createEl('button', { cls: CssClass.MinimizeButton });
    setIcon(buttonEl, MINIMIZE_ICON_ID);
    buttonEl.addEventListener('click', () => {
      this.minimize();
    });
  }

  private createMinimizedBar(): HTMLElement {
    const barEl = this.containerEl.ownerDocument.body.createDiv({ cls: CssClass.MinimizedModalBar });
    barEl.createSpan({
      cls: CssClass.MinimizedModalBarTitle,
      text: this.title
    });
    const restoreButtonEl = barEl.createEl('button', { cls: CssClass.RestoreButton });
    setIcon(restoreButtonEl, RESTORE_ICON_ID);
    restoreButtonEl.addEventListener('click', () => {
      this.restore();
    });
    return barEl;
  }

  private removeMinimizedBar(): void {
    this.minimizedBarEl?.remove();
    this.minimizedBarEl = null;
  }
}
