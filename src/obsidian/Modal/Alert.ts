/**
 * @packageDocumentation Alert
 * Utility for displaying alert modals in Obsidian.
 *
 * This module exports a function to display a modal with a message in Obsidian. The modal includes an "OK" button to close it.
 */

import {
  type App,
  Modal
} from "obsidian";

/**
 * Displays an alert modal in Obsidian with a specified message.
 *
 * @param {App} app - The Obsidian app instance.
 * @param {string} message - The message to display in the modal.
 * @returns {Promise<void>} - A promise that resolves when the modal is closed.
 */
export async function alert(app: App, message: string): Promise<void> {
  return new Promise<void>((resolve) => {
    class AlertModal extends Modal {
      public constructor(app: App) {
        super(app);
      }

      public override onOpen(): void {
        this.setContent(createFragment((fragment) => {
          const modalContent = fragment.createDiv({ cls: "mod-cta" });
          modalContent.createEl("p", { text: message });
          modalContent.createEl("button", {
            cls: "mod-cta",
            text: "OK",
            onclick: () => this.close()
          } as DomElementInfo);
        }));
      }

      public override onClose(): void {
        resolve();
      }
    }

    const modal = new AlertModal(app);
    modal.open();
  });
}
