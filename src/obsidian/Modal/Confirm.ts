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

/**
 * The options for the confirm modal.
 */
export interface ConfirmOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The title of the modal.
   */
  title?: string | DocumentFragment;

  /**
   * The message to display in the modal.
   */
  message: string | DocumentFragment;

  /**
   * The text for the "OK" button.
   */
  okButtonText?: string;

  /**
   * The text for the "Cancel" button.
   */
  cancelButtonText?: string;

  /**
   * The styles to apply to the "OK" button.
   */
  okButtonStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The styles to apply to the "Cancel" button.
   */
  cancelButtonStyles?: Partial<CSSStyleDeclaration>;
}

/**
 * Displays an confirm modal in Obsidian with a specified message.
 *
 * @param options - The options for the confirm modal.
 * @returns A promise that resolves with a boolean indicating whether the "OK" button was clicked.
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const modal = new ConfirmModal(options, resolve);
    modal.open();
  });
}

class ConfirmModal extends Modal {
  private options: Required<ConfirmOptions>;
  private isConfirmed = false;

  public constructor(options: ConfirmOptions, private resolve: (value: boolean) => void) {
    super(options.app);
    const DEFAULT_OPTIONS: Required<ConfirmOptions> = {
      app: options.app,
      title: '',
      message: '',
      okButtonText: 'OK',
      cancelButtonText: 'Cancel',
      okButtonStyles: {
        marginTop: '20px',
        marginRight: '10px'
      },
      cancelButtonStyles: {}
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
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
    cancelButton.setButtonText(this.options.okButtonText);
    cancelButton.onClick(this.close.bind(this));
    Object.assign(okButton.buttonEl.style, this.options.okButtonStyles);
  }

  public override onClose(): void {
    this.resolve(this.isConfirmed);
  }
}
