/**
 * @packageDocumentation Alert
 * Utility for displaying alert modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes an "OK" button to close it.
 */

import type { App } from 'obsidian';
import {
  ButtonComponent,
  Modal
} from 'obsidian';

/**
 * The options for the alert modal.
 */
export interface AlertOptions {
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
   * The styles to apply to the "OK" button.
   */
  okButtonStyles?: Partial<CSSStyleDeclaration>;
}

/**
 * Displays an alert modal in Obsidian with a specified message.
 *
 * @param options - The options for the alert modal.
 * @returns A promise that resolves when the modal is closed.
 */
export async function alert(options: AlertOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    const modal = new AlertModal(options, resolve);
    modal.open();
  });
}

class AlertModal extends Modal {
  private options: Required<AlertOptions>;

  public constructor(options: AlertOptions, private resolve: () => void) {
    super(options.app);
    const DEFAULT_OPTIONS: Required<AlertOptions> = {
      app: options.app,
      title: '',
      message: '',
      okButtonText: 'OK',
      okButtonStyles: {}
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
    okButton.onClick(this.close.bind(this));
    Object.assign(okButton.buttonEl.style, this.options.okButtonStyles);
  }

  public override onClose(): void {
    this.resolve();
  }
}
