/**
 * @file
 *
 * Utility for displaying a prompt modal in Obsidian.
 *
 * This module exports a function to display a modal that prompts the user for input. The modal includes "OK" and "Cancel" buttons.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import {
  ButtonComponent,
  TextComponent
} from 'obsidian';

import type { PromiseResolve } from '../../async.ts';
import type { MaybeReturn } from '../../type.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../async.ts';
import { CssClass } from '../../css-class.ts';
import { noop } from '../../function.ts';
import { t } from '../i18n/i18n.ts';
import {
  ModalBase,
  showModal
} from './modal-base.ts';

/**
 * Options for {@link prompt}.
 */
export interface PromptParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A text for the "Cancel" button.
   */
  readonly cancelButtonText?: string;

  /**
   * A default value to pre-fill the input field.
   */
  readonly defaultValue?: string;

  /**
   * A text for the "OK" button.
   */
  readonly okButtonText?: string;

  /**
   * A placeholder text for the input field.
   */
  readonly placeholder?: string;

  /**
   * A title of the modal.
   */
  readonly title?: DocumentFragment | string;

  /**
   * A function to validate the input value.
   *
   * @param value - The input value to validate.
   * @returns an error message if the value is invalid, or `null` if the value is valid.
   */
  readonly valueValidator?: (value: string) => Promisable<MaybeReturn<string>>;
}

class PromptModal extends ModalBase<null | string, PromptParams> {
  private isOkClicked = false;
  private readonly params: Required<PromptParams>;
  private value: string;

  public constructor(params: PromptParams, resolve: PromiseResolve<null | string>) {
    super(params, resolve, CssClass.PromptModal);
    const DEFAULT_OPTIONS: Required<PromptParams> = {
      app: params.app,
      cancelButtonText: t(($) => $.obsidianDevUtils.buttons.cancel),
      defaultValue: '',
      okButtonText: t(($) => $.obsidianDevUtils.buttons.ok),
      placeholder: '',
      title: '',
      valueValidator: noop
    };
    this.params = { ...DEFAULT_OPTIONS, ...params };
    this.value = params.defaultValue ?? '';
  }

  public override onClose(): void {
    super.onClose();
    this.resolve(this.isOkClicked ? this.value : null);
  }

  public override onOpen(): void {
    super.onOpen();
    this.titleEl.setText(this.params.title);
    const textComponent = new TextComponent(this.contentEl);
    const inputEl = textComponent.inputEl;

    const validate = async (): Promise<void> => {
      const errorMessage = await this.params.valueValidator(inputEl.value) as string | undefined;
      inputEl.setCustomValidity(errorMessage ?? '');
      inputEl.reportValidity();
    };

    textComponent.setValue(this.value);
    textComponent.inputEl.select();
    textComponent.setPlaceholder(this.params.placeholder);
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
    okButton.setButtonText(this.params.okButtonText);
    okButton.setCta();
    okButton.onClick((event) => {
      this.handleOk(event, textComponent);
    });
    okButton.setClass(CssClass.OkButton);
    const cancelButton = new ButtonComponent(this.contentEl);
    cancelButton.setButtonText(this.params.cancelButtonText);
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
 * @param params - The parameters for the prompt modal.
 * @returns A {@link Promise} that resolves with the user input or `null` if the prompt was cancelled.
 */
export async function prompt(params: PromptParams): Promise<null | string> {
  return await showModal<null | string>((resolve) => new PromptModal(params, resolve));
}
