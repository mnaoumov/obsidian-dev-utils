/**
 * @file
 *
 * Utility for displaying confirm modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes "OK" and "Cancel" buttons to confirm or cancel the action.
 */

import { ButtonComponent } from 'obsidian';

import type {
  ModalBaseConstructorParams,
  ModalParamsBase
} from './modal.ts';

import { CssClass } from '../../css-class.ts';
import { t } from '../i18n/i18n.ts';
import {
  ModalBase,
  showModal
} from './modal.ts';

/**
 * Parameters for {@link confirm}.
 */
export interface ConfirmParams extends ModalParamsBase {
  /**
   * A text for the "Cancel" button.
   */
  readonly cancelButtonText?: string;

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

type ConfirmModalConstructorParams = ConfirmParams & ModalBaseConstructorParams<boolean>;

class ConfirmModal extends ModalBase<boolean> {
  private readonly cancelButtonText: string;
  private isConfirmed = false;
  private readonly message: DocumentFragment | string;
  private readonly okButtonText: string;
  private readonly title: DocumentFragment | string;

  public constructor(params: ConfirmModalConstructorParams) {
    super(params);
    this.addCssClasses(CssClass.ConfirmModal);
    this.cancelButtonText = params.cancelButtonText ?? t(($) => $.obsidianDevUtils.buttons.cancel);
    this.message = params.message;
    this.okButtonText = params.okButtonText ?? t(($) => $.obsidianDevUtils.buttons.ok);
    this.title = params.title ?? '';
  }

  public override onClose(): void {
    this.promiseResolve(this.isConfirmed);
  }

  public override onOpen(): void {
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
  return await showModal<boolean>((promiseResolve) =>
    new ConfirmModal({
      ...params,
      promiseResolve
    })
  );
}
