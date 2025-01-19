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

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';

/**
 * The options for the prompt modal.
 */
export interface PromptOptions {
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
   * The default value to pre-fill the input field.
   */
  defaultValue?: string;

  /**
   * The styles to apply to the "OK" button.
   */
  okButtonStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The text for the "OK" button.
   */
  okButtonText?: string;

  /**
   * The placeholder text for the input field.
   */
  placeholder?: string;

  /**
   * The styles to apply to the input field.
   */
  textBoxStyles?: Partial<CSSStyleDeclaration>;

  /**
   * The title of the modal.
   */
  title?: DocumentFragment | string;

  /**
   * A function to validate the input value.
   * @param value - The input value to validate.
   * @returns an error message if the value is invalid, or null if the value is valid.
   */
  valueValidator?: (value: string) => null | string;
}

class PromptModal extends Modal {
  private isOkClicked = false;
  private options: Required<PromptOptions>;
  private value: string;

  public constructor(options: PromptOptions, private resolve: (value: null | string) => void) {
    super(options.app);
    const DEFAULT_OPTIONS: Required<PromptOptions> = {
      app: options.app,
      cancelButtonStyles: {},
      cancelButtonText: 'Cancel',
      defaultValue: '',
      okButtonStyles: {
        marginRight: '10px',
        marginTop: '20px'
      },
      okButtonText: 'OK',
      placeholder: '',
      textBoxStyles: {
        width: '100%'
      },
      title: '',
      valueValidator: () => null
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.value = options.defaultValue ?? '';
    this.containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.PromptModal);
  }

  public override onClose(): void {
    this.resolve(this.isOkClicked ? this.value : null);
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

  private handleOk(event: Event, textComponent: TextComponent): void {
    event.preventDefault();
    if (!textComponent.inputEl.checkValidity()) {
      return;
    }

    this.isOkClicked = true;
    this.close();
  }
}

/**
 * Displays a prompt modal in Obsidian to get user input.
 *
 * @param options - The options for the prompt modal.
 * @returns A promise that resolves with the user input or null if the prompt was cancelled.
 */
export async function prompt(options: PromptOptions): Promise<null | string> {
  return new Promise<null | string>((resolve) => {
    const modal = new PromptModal(options, resolve);
    modal.open();
  });
}
