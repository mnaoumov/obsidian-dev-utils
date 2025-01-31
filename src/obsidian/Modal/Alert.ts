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

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';

/**
 * The options for the alert modal.
 */
export interface AlertOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

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

class AlertModal extends Modal {
  private options: Required<AlertOptions>;

  public constructor(options: AlertOptions, private resolve: () => void) {
    super(options.app);
    const DEFAULT_OPTIONS: Required<AlertOptions> = {
      app: options.app,
      message: '',
      okButtonStyles: {},
      okButtonText: 'OK',
      title: ''
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.AlertModal);
  }

  public override onClose(): void {
    this.resolve();
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
}

/**
 * Displays an alert modal in Obsidian with a specified message.
 *
 * @param options - The options for the alert modal.
 * @returns A promise that resolves when the modal is closed.
 */
export async function alert(options: AlertOptions): Promise<void> {
  await new Promise<void>((resolve) => {
    const modal = new AlertModal(options, resolve);
    modal.open();
  });
}
