/**
 * @packageDocumentation
 *
 * Utility for displaying confirm modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes "OK" and "Cancel" buttons to confirm or cancel the action.
 */

import type { App } from 'obsidian';

import { ButtonComponent } from 'obsidian';

import type { PromiseResolve } from '../../Async.ts';

import { CssClass } from '../../CssClass.ts';
import { t } from '../i18n/i18n.ts';
import {
  ModalBase,
  showModal
} from './ModalBase.ts';

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

class ConfirmModal extends ModalBase<boolean, ConfirmParams> {
  private isConfirmed = false;
  private readonly options: Required<ConfirmParams>;

  public constructor(options: ConfirmParams, resolve: PromiseResolve<boolean>) {
    super(options, resolve, CssClass.ConfirmModal);
    const DEFAULT_OPTIONS: Required<ConfirmParams> = {
      app: options.app,
      cancelButtonText: t(($) => $.obsidianDevUtils.buttons.cancel),
      cssClass: '',
      message: options.message,
      okButtonText: t(($) => $.obsidianDevUtils.buttons.ok),
      title: ''
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  public override onClose(): void {
    super.onClose();
    this.resolve(this.isConfirmed);
  }

  public override onOpen(): void {
    super.onOpen();
    this.titleEl.setText(this.options.title);
    this.contentEl.createEl('p', { text: this.options.message });
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.options.okButtonText);
    okButton.setCta();
    okButton.onClick(() => {
      this.isConfirmed = true;
      this.close();
    });
    okButton.setClass(CssClass.OkButton);

    const cancelButton = new ButtonComponent(this.contentEl);
    cancelButton.setButtonText(this.options.cancelButtonText);
    cancelButton.onClick(this.close.bind(this));
    cancelButton.setClass(CssClass.CancelButton);
  }
}

/**
 * Displays an confirm modal in Obsidian with a specified message.
 *
 * @param options - The options for the confirm modal.
 * @returns A {@link Promise} that resolves with a boolean indicating whether the "OK" button was clicked.
 */
export async function confirm(options: ConfirmParams): Promise<boolean> {
  return await showModal<boolean>((resolve) => new ConfirmModal(options, resolve));
}
