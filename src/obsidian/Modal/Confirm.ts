/**
 * @packageDocumentation Confirm
 * Utility for displaying confirm modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes "OK" and "Cancel" buttons to confirm or cancel the action.
 */

import type { App } from 'obsidian';
import { Modal } from 'obsidian';

/**
 * Displays an confirm modal in Obsidian with a specified message.
 *
 * @param app - The Obsidian app instance.
 * @param message - The message to display in the modal.
 * @returns A promise that resolves with a boolean indicating whether the "OK" button was clicked.
 */
export async function confirm(app: App, message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const modal = new ConfirmModal(app, message, resolve);
    modal.open();
  });
}

class ConfirmModal extends Modal {
  private isConfirmed = false;

  public constructor(app: App, private message: string, private resolve: (value: boolean) => void) {
    super(app);
  }

  public override onOpen(): void {
    this.setContent(createFragment((fragment) => {
      const modalContent = fragment.createDiv({ cls: 'mod-cta' });
      modalContent.createEl('p', { text: this.message });
      modalContent.createEl('button', {
        cls: 'mod-cta',
        text: 'OK',
        onclick: () => {
          this.isConfirmed = true;
          this.close();
        }
      } as DomElementInfo);
      modalContent.createEl('button', {
        text: 'Cancel',
        onclick: this.close.bind(this)
      } as DomElementInfo);
    }));
  }

  public override onClose(): void {
    this.resolve(this.isConfirmed);
  }
}
