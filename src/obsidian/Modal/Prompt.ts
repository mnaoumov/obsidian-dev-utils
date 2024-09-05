/**
 * @packageDocumentation Prompt
 * Utility for displaying a prompt modal in Obsidian.
 *
 * This module exports a function to display a modal that prompts the user for input. The modal includes "OK" and "Cancel" buttons.
 */

import {
  App,
  ButtonComponent,
  Modal,
  TextComponent
} from 'obsidian';

/**
 * The options for the prompt modal.
 */
export interface PromptOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The title of the modal.
   */
  title?: string;

  /**
   * The default value to pre-fill the input field.
   */
  defaultValue?: string;

  /**
   * A function to validate the input value.
   * @param value - The input value to validate.
   * @returns an error message if the value is invalid, or null if the value is valid.
   */
  valueValidator?: (value: string) => string | null;
}

/**
 * Displays a prompt modal in Obsidian to get user input.
 *
 * @param options - The options for the prompt modal.
 * @returns - A promise that resolves with the user input or null if the prompt was cancelled.
 */
export async function prompt(options: PromptOptions): Promise<string | null> {
  const {
    app,
    title,
    defaultValue,
    valueValidator
  } = options;
  return new Promise<string | null>((resolve): void => {
    class PromptModal extends Modal {
      private value = '';
      private isCancelled = true;

      public constructor() {
        super(app);
      }

      public override onOpen(): void {
        this.value = defaultValue ?? '';
        this.titleEl.setText(title ?? '');
        const textComponent = new TextComponent(this.contentEl);
        textComponent.setValue(this.value);
        textComponent.setPlaceholder(this.value);
        textComponent.inputEl.style.width = '100%';
        textComponent.onChange((value) => this.value = value);
        textComponent.inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            this.handleOk(event, textComponent);
          } else if (event.key === 'Escape') {
            this.close();
          }
        });
        if (valueValidator) {
          textComponent.inputEl.addEventListener('input', () => {
            const errorMessage = valueValidator(textComponent.inputEl.value);
            textComponent.inputEl.setCustomValidity(errorMessage ?? '');
            textComponent.inputEl.reportValidity();
          });
        }
        const okButton = new ButtonComponent(this.contentEl);
        okButton.setButtonText('OK');
        okButton.setClass('mod-cta');
        okButton.onClick((event) => {
          this.handleOk(event, textComponent);
        });
        okButton.buttonEl.style.marginTop = '20px';
        okButton.buttonEl.style.marginRight = '10px';
        const cancelButton = new ButtonComponent(this.contentEl);
        cancelButton.setButtonText('Cancel');
        cancelButton.onClick(this.close.bind(this));
      }

      public override onClose(): void {
        resolve(this.isCancelled ? null : this.value);
      }

      private handleOk(event: Event, textComponent: TextComponent): void {
        event.preventDefault();
        if (!textComponent.inputEl.checkValidity()) {
          return;
        }

        this.isCancelled = false;
        this.close();
      }
    }

    const modal = new PromptModal();
    modal.open();
  });
}
