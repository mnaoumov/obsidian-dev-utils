/**
 * @packageDocumentation
 *
 * Utility for displaying alert modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes an "OK" button to close it.
 */

import type { App } from 'obsidian';

import { ButtonComponent } from 'obsidian';

import type { PromiseResolve } from '../../Async.ts';

import { CssClass } from '../../CssClass.ts';
import {
  ModalBase,
  showModal
} from './ModalBase.ts';

/**
 * The options for the alert modal.
 */
export interface AlertOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The CSS class to apply to the modal.
   */
  cssClass?: string;

  /**
   * The message to display in the modal.
   */
  message: DocumentFragment | string;

  /**
   * The text for the "OK" button.
   */
  okButtonText?: string;

  /**
   * The title of the modal.
   */
  title?: DocumentFragment | string;
}

class AlertModal extends ModalBase<void, AlertOptions> {
  private options: Required<AlertOptions>;

  public constructor(options: AlertOptions, resolve: PromiseResolve<void>) {
    super(options, resolve, CssClass.AlertModal);
    const DEFAULT_OPTIONS: Required<AlertOptions> = {
      app: options.app,
      cssClass: '',
      message: options.message,
      okButtonText: 'OK',
      title: ''
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  public override onClose(): void {
    this.resolve();
  }

  public override onOpen(): void {
    this.titleEl.setText(this.options.title);
    this.contentEl.createEl('p', { text: this.options.message });
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.options.okButtonText);
    okButton.setCta();
    okButton.onClick(this.close.bind(this));
    okButton.setClass(CssClass.OkButton);
  }
}

/**
 * Displays an alert modal in Obsidian with a specified message.
 *
 * @param options - The options for the alert modal.
 * @returns A {@link Promise} that resolves when the modal is closed.
 */
export async function alert(options: AlertOptions): Promise<void> {
  await showModal((resolve) => new AlertModal(options, resolve));
}
