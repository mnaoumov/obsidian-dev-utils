/**
 * @packageDocumentation
 *
 * Utility for displaying alert modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes an "OK" button to close it.
 */

import type { App } from 'obsidian';

import { t } from 'i18next';
import { ButtonComponent } from 'obsidian';

import type { PromiseResolve } from '../../Async.ts';

import { CssClass } from '../../CssClass.ts';
import {
  ModalBase,
  showModal
} from './ModalBase.ts';

/**
 * Options for {@link alert}.
 */
export interface AlertParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

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

class AlertModal extends ModalBase<void, AlertParams> {
  private readonly params: Required<AlertParams>;

  public constructor(params: AlertParams, resolve: PromiseResolve<void>) {
    super(params, resolve, CssClass.AlertModal);
    const DEFAULT_OPTIONS: Required<AlertParams> = {
      app: params.app,
      cssClass: '',
      message: params.message,
      okButtonText: t(($) => $.obsidianDevUtils.buttons.ok),
      title: ''
    };
    this.params = { ...DEFAULT_OPTIONS, ...params };
  }

  public override onClose(): void {
    super.onClose();
    this.resolve();
  }

  public override onOpen(): void {
    super.onOpen();
    this.titleEl.setText(this.params.title);
    this.contentEl.createEl('p', { text: this.params.message });
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.params.okButtonText);
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
