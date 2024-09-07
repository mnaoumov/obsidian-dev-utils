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
  title?: string | DocumentFragment;

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

  /**
   * The text for the "OK" button.
   */
  okButtonText?: string;

  /**
   * The text for the "Cancel" button.
   */
  cancelButtonText?: string;

  /**
   * The styles to apply to the input field.
   */
  textBoxStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The styles to apply to the "OK" button.
   */
  okButtonStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The styles to apply to the "Cancel" button.
   */
  cancelButtonStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The placeholder text for the input field.
   */
  placeholder?: string;
}

/**
 * Displays a prompt modal in Obsidian to get user input.
 *
 * @param options - The options for the prompt modal.
 * @returns A promise that resolves with the user input or null if the prompt was cancelled.
 */
export async function prompt(options: PromptOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const modal = new PromptModal(options, resolve);
    modal.open();
  });
}

class PromptModal extends Modal {
  private value: string;
  private isOkClicked = false;
  private options: Required<PromptOptions>;

  public constructor(options: PromptOptions, private resolve: (value: string | null) => void) {
    super(options.app);
    const DEFAULT_OPTIONS: Required<PromptOptions> = {
      app: options.app,
      title: '',
      defaultValue: '',
      valueValidator: () => null,
      okButtonText: 'OK',
      cancelButtonText: 'Cancel',
      textBoxStyles: {
        width: '100%'
      },
      okButtonStyles: {
        marginTop: '20px',
        marginRight: '10px'
      },
      cancelButtonStyles: {},
      placeholder: ''
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.value = options.defaultValue ?? '';
  }

  public override onOpen(): void {
    this.titleEl.setText(this.options.title);
    const textComponent = new TextComponent(this.contentEl);
    textComponent.setValue(this.value);
    textComponent.setPlaceholder(this.options.placeholder);
    Object.assign(textComponent.inputEl.style, this.options.textBoxStyles);
    textComponent.onChange((newValue) => this.value = newValue);
    textComponent.inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.handleOk(event, textComponent);
      } else if (event.key === 'Escape') {
        this.close();
      }
    });
    textComponent.inputEl.addEventListener('input', () => {
      const errorMessage = this.options.valueValidator(textComponent.inputEl.value);
      textComponent.inputEl.setCustomValidity(errorMessage ?? '');
      textComponent.inputEl.reportValidity();
    });
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.options.okButtonText);
    okButton.setCta();
    okButton.onClick((event) => {
      this.handleOk(event, textComponent);
    });
    Object.assign(okButton.buttonEl.style, this.options.okButtonStyles);
    const cancelButton = new ButtonComponent(this.contentEl);
    cancelButton.setButtonText(this.options.cancelButtonText);
    cancelButton.onClick(this.close.bind(this));
    Object.assign(cancelButton.buttonEl.style, this.options.cancelButtonStyles);
  }

  public override onClose(): void {
    this.resolve(this.isOkClicked ? this.value : null);
  }

  private handleOk(event: Event, textComponent: TextComponent): void {
    event.preventDefault();
    if (!textComponent.inputEl.checkValidity()) {
      return;
    }

    this.isOkClicked = true;
    this.close();
  }
}
