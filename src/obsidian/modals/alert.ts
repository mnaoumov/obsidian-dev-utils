/**
 * @file
 *
 * Utility for displaying alert modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes an "OK" button to close it.
 */

import { t } from 'i18next';
import { ButtonComponent } from 'obsidian';

import type { PromiseResolve } from '../../async.ts';
import type { ModalParamsBase } from './modal.ts';

import { CssClass } from '../../css-class.ts';
import {
  addCssClass,
  ModalBase,
  showModal
} from './modal.ts';

/**
 * Parameters for {@link AlertModal}.
 */
export interface AlertParams extends ModalParamsBase {
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

class AlertModal extends ModalBase<void> {
  private readonly message: DocumentFragment | string;
  private readonly okButtonText: string;
  private readonly title: DocumentFragment | string;

  public constructor(params: AlertParams, resolve: PromiseResolve<void>) {
    super(addCssClass(params, CssClass.AlertModal), resolve);
    this.message = params.message;
    this.okButtonText = params.okButtonText ?? t(($) => $.obsidianDevUtils.buttons.ok);
    this.title = params.title ?? '';
  }

  public override onClose(): void {
    super.onClose();
    this.resolve();
  }

  public override onOpen(): void {
    super.onOpen();
    this.titleEl.setText(this.title);
    this.contentEl.createEl('p', { text: this.message });
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.okButtonText);
    okButton.setCta();
    okButton.onClick(this.close.bind(this));
    okButton.setClass(CssClass.OkButton);
  }
}

/**
 * Displays an alert modal in Obsidian with a specified message.
 *
 * @param params - The parameters for the alert modal.
 * @returns A {@link Promise} that resolves when the modal is closed.
 */
export async function alert(params: AlertParams): Promise<void> {
  await showModal((resolve) => new AlertModal(params, resolve));
}
