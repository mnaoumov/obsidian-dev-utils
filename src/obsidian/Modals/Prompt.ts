/**
 * @packageDocumentation Prompt
 * Utility for displaying a prompt modal in Obsidian.
 *
 * This module exports a function to display a modal that prompts the user for input. The modal includes "OK" and "Cancel" buttons.
 */

import type { App } from 'obsidian';

import {
  ButtonComponent,
  TextComponent
} from 'obsidian';

import type {
  MaybePromise,
  PromiseResolve
} from '../../Async.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../Async.ts';
import { CssClass } from '../../CssClass.ts';
import { noop } from '../../Function.ts';
import {
  ModalBase,
  showModal
} from './ModalBase.ts';

/**
 * The options for the prompt modal.
 */
export interface PromptOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The text for the "Cancel" button.
   */
  cancelButtonText?: string;

  /**
   * The default value to pre-fill the input field.
   */
  defaultValue?: string;

  /**
   * The text for the "OK" button.
   */
  okButtonText?: string;

  /**
   * The placeholder text for the input field.
   */
  placeholder?: string;

  /**
   * The title of the modal.
   */
  title?: DocumentFragment | string;

  /**
   * A function to validate the input value.
   * @param value - The input value to validate.
   * @returns an error message if the value is invalid, or null if the value is valid.
   */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  valueValidator?: (value: string) => MaybePromise<string | void>;
}

class PromptModal extends ModalBase<null | string, PromptOptions> {
  private isOkClicked = false;
  private options: Required<PromptOptions>;
  private value: string;

  public constructor(options: PromptOptions, resolve: PromiseResolve<null | string>) {
    super(options, resolve, CssClass.PromptModal);
    const DEFAULT_OPTIONS: Required<PromptOptions> = {
      app: options.app,
      cancelButtonText: 'Cancel',
      defaultValue: '',
      okButtonText: 'OK',
      placeholder: '',
      title: '',
      valueValidator: noop
    };
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.value = options.defaultValue ?? '';
  }

  public override onClose(): void {
    this.resolve(this.isOkClicked ? this.value : null);
  }

  public override onOpen(): void {
    this.titleEl.setText(this.options.title);
    const textComponent = new TextComponent(this.contentEl);
    const inputEl = textComponent.inputEl;

    const validate = async (): Promise<void> => {
      const errorMessage = await this.options.valueValidator(inputEl.value) as string | undefined;
      inputEl.setCustomValidity(errorMessage ?? '');
      inputEl.reportValidity();
    };

    textComponent.setValue(this.value);
    textComponent.setPlaceholder(this.options.placeholder);
    inputEl.addClass(CssClass.TextBox);
    textComponent.onChange((newValue) => {
      this.value = newValue;
    });
    inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.handleOk(event, textComponent);
      } else if (event.key === 'Escape') {
        this.close();
      }
    });
    inputEl.addEventListener('input', convertAsyncToSync(validate));
    inputEl.addEventListener('focus', convertAsyncToSync(validate));
    invokeAsyncSafely(validate);
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.options.okButtonText);
    okButton.setCta();
    okButton.onClick((event) => {
      this.handleOk(event, textComponent);
    });
    okButton.setClass(CssClass.OkButton);
    const cancelButton = new ButtonComponent(this.contentEl);
    cancelButton.setButtonText(this.options.cancelButtonText);
    cancelButton.onClick(this.close.bind(this));
    cancelButton.setClass(CssClass.CancelButton);
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
  return await showModal<null | string>((resolve) => new PromptModal(options, resolve));
}
