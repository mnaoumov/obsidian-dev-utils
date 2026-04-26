/**
 * @file
 *
 * Utility for displaying confirm modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes "OK" and "Cancel" buttons to confirm or cancel the action.
 */

import type { App } from 'obsidian';

import { ButtonComponent } from 'obsidian';

import type { PromiseResolve } from '../../async.ts';

import { CssClass } from '../../css-class.ts';
import { t } from '../i18n/i18n.ts';
import {
  addCssClass,
  ModalBase,
  showModal
} from './modal.ts';

/**
 * Options for {@link confirm}.
 */
export interface ConfirmParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A text for the "Cancel" button.
   */
  readonly cancelButtonText?: string;

  /**
   * A CSS class to apply to the modal.
   */
  readonly cssClass?: string;

  /**
   * A message to display in the modal.
   */
  readonly message: DocumentFragment | string;

  /**
   * A text for the "OK" button.
   */
  readonly okButtonText?: string;

  /**
   * A title of the modal.
   */
  readonly title?: DocumentFragment | string;
}

class ConfirmModal extends ModalBase<boolean> {
  private readonly cancelButtonText: string;
  private isConfirmed = false;
  private readonly message: DocumentFragment | string;
  private readonly okButtonText: string;
  private readonly title: DocumentFragment | string;

  public constructor(params: ConfirmParams, resolve: PromiseResolve<boolean>) {
    super(addCssClass(params, CssClass.ConfirmModal), resolve);
    this.cancelButtonText = params.cancelButtonText ?? t(($) => $.obsidianDevUtils.buttons.cancel);
    this.message = params.message;
    this.okButtonText = params.okButtonText ?? t(($) => $.obsidianDevUtils.buttons.ok);
    this.title = params.title ?? '';
  }

  public override onClose(): void {
    super.onClose();
    this.resolve(this.isConfirmed);
  }

  public override onOpen(): void {
    super.onOpen();
    this.titleEl.setText(this.title);
    this.contentEl.createEl('p', { text: this.message });
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.okButtonText);
    okButton.setCta();
    okButton.onClick(() => {
      this.isConfirmed = true;
      this.close();
    });
    okButton.setClass(CssClass.OkButton);

    const cancelButton = new ButtonComponent(this.contentEl);
    cancelButton.setButtonText(this.cancelButtonText);
    cancelButton.onClick(this.close.bind(this));
    cancelButton.setClass(CssClass.CancelButton);
  }
}

/**
 * Displays an confirm modal in Obsidian with a specified message.
 *
 * @param params - The parameters for the confirm modal.
 * @returns A {@link Promise} that resolves with a boolean indicating whether the "OK" button was clicked.
 */
export async function confirm(params: ConfirmParams): Promise<boolean> {
  return await showModal<boolean>((resolve) => new ConfirmModal(params, resolve));
}
