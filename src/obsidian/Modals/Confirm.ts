/**
 * @packageDocumentation Confirm
 * Utility for displaying confirm modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes "OK" and "Cancel" buttons to confirm or cancel the action.
 */

import type { App } from 'obsidian';

import {
  ButtonComponent,
  Modal
} from 'obsidian';

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';

/**
 * The options for the confirm modal.
 */
export interface ConfirmOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The styles to apply to the "Cancel" button.
   */
  cancelButtonStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The text for the "Cancel" button.
   */
  cancelButtonText?: string;

  /**
   * The message to display in the modal.
   */
  message: DocumentFragment | string;

  /**
   * The styles to apply to the "OK" button.
   */
  okButtonStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The text for the "OK" button.
   */
  okButtonText?: string;

  /**
   * The title of the modal.
   */
  title?: DocumentFragment | string;
}

class ConfirmModal extends Modal {
  private isConfirmed = false;
  private options: Required<ConfirmOptions>;

  public constructor(options: ConfirmOptions, private resolve: (value: boolean) => void) {
    super(options.app);
    const DEFAULT_OPTIONS: Required<ConfirmOptions> = {
      app: options.app,
      cancelButtonStyles: {},
      cancelButtonText: 'Cancel',
      message: '',
      okButtonStyles: {
        marginRight: '10px',
        marginTop: '20px'
      },
      okButtonText: 'OK',
      title: ''
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.ConfirmModal);
  }

  public override onClose(): void {
    this.resolve(this.isConfirmed);
  }

  public override onOpen(): void {
    this.titleEl.setText(this.options.title);
    const paragraph = this.contentEl.createEl('p');
    paragraph.setText(this.options.message);
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.options.okButtonText);
    okButton.setCta();
    okButton.onClick(() => {
      this.isConfirmed = true;
      this.close();
    });
    Object.assign(okButton.buttonEl.style, this.options.okButtonStyles);

    const cancelButton = new ButtonComponent(this.contentEl);
    cancelButton.setButtonText(this.options.cancelButtonText);
    cancelButton.onClick(this.close.bind(this));
    Object.assign(okButton.buttonEl.style, this.options.okButtonStyles);
  }
}

/**
 * Displays an confirm modal in Obsidian with a specified message.
 *
 * @param options - The options for the confirm modal.
 * @returns A promise that resolves with a boolean indicating whether the "OK" button was clicked.
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const modal = new ConfirmModal(options, resolve);
    modal.open();
  });
}
