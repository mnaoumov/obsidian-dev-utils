/**
 * @file
 *
 * Utility for displaying a prompt modal in Obsidian.
 *
 * This module exports a function to display a modal that prompts the user for input. The modal includes "OK" and "Cancel" buttons.
 */

import type { Promisable } from 'type-fest';

import {
  ButtonComponent,
  TextComponent
} from 'obsidian';

import type { MaybeReturn } from '../../type.ts';
import type {
  ModalBaseConstructorParams,
  ModalParamsBase
} from './modal.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../async.ts';
import { noop } from '../../function.ts';
import { CssClass } from '../css-class.ts';
import { t } from '../i18n/i18n.ts';
import { isSpellcheckEnabled } from '../obsidian-settings.ts';
import {
  ModalBase,
  showModal
} from './modal.ts';

/**
 * Options for {@link prompt}.
 */
export interface PromptParams extends ModalParamsBase {
  /**
   * A text for the "Cancel" button.
   */
  readonly cancelButtonText?: string;

  /**
   * A default value to pre-fill the input field.
   *
   * @default `''`
   */
  readonly defaultValue?: string;

  /**
   * A text for the "OK" button.
   */
  readonly okButtonText?: string;

  /**
   * A placeholder text for the input field.
   *
   * @default `''`
   */
  readonly placeholder?: string;

  /**
   * A title of the modal.
   *
   * @default `''`
   */
  readonly title?: DocumentFragment | string;

  /**
   * A function to validate the input value.
   *
   * @param value - The input value to validate.
   * @returns an error message if the value is invalid, or `null` if the value is valid.
   */
  valueValidator?(this: void, value: string): Promisable<MaybeReturn<string>>;
}

type PromptModalConstructorParams = ModalBaseConstructorParams<null | string> & PromptParams;

class PromptModal extends ModalBase<null | string> {
  private readonly cancelButtonText: string;
  private isOkClicked = false;
  private isTouched = false;
  private readonly okButtonText: string;
  private readonly placeholder: string;
  private readonly title: DocumentFragment | string;
  private value: string;
  private readonly valueValidator: (value: string) => Promisable<MaybeReturn<string>>;

  public constructor(params: PromptModalConstructorParams) {
    super(params);
    this.addCssClasses(CssClass.PromptModal);
    this.cancelButtonText = params.cancelButtonText ?? t(($) => $.obsidianDevUtils.buttons.cancel);
    this.okButtonText = params.okButtonText ?? t(($) => $.obsidianDevUtils.buttons.ok);
    this.placeholder = params.placeholder ?? '';
    this.title = params.title ?? '';
    this.valueValidator = params.valueValidator ?? noop;
    this.value = params.defaultValue ?? '';
  }

  public override onClose(): void {
    this.promiseResolve(this.isOkClicked ? this.value : null);
  }

  public override onOpen(): void {
    this.titleEl.setText(this.title);
    const textComponent = new TextComponent(this.contentEl);
    const inputEl = textComponent.inputEl;
    // `AbstractTextComponent` forces `spellcheck="false"` on every text component, so the vault setting has to be re-applied here.
    // Obsidian's own file explorer reads the same config when it starts an inline rename.
    inputEl.setAttribute('spellcheck', String(isSpellcheckEnabled(this.app)));

    const validate = async (shouldReport: boolean): Promise<void> => {
      const errorMessage = await this.valueValidator(inputEl.value) as string | undefined;
      inputEl.setCustomValidity(errorMessage ?? '');
      if (shouldReport) {
        inputEl.reportValidity();
      }
    };

    const handleInput = async (): Promise<void> => {
      this.markTouched(inputEl);
      await validate(true);
    };

    const handleFocus = async (): Promise<void> => {
      await validate(this.isTouched);
    };

    textComponent.setValue(this.value);
    textComponent.inputEl.select();
    textComponent.setPlaceholder(this.placeholder);
    inputEl.addClass(CssClass.TextBox);
    // The modal opens invalid by design (see below), so the invalid styling is deferred until touched.
    inputEl.addClass(CssClass.Untouched);
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
    inputEl.addEventListener('input', convertAsyncToSync(handleInput));
    inputEl.addEventListener('focus', convertAsyncToSync(handleFocus));
    // The modal must start out invalid so OK refuses, but the validity is not reported until the user types or submits.
    invokeAsyncSafely(() => validate(false));
    const okButton = new ButtonComponent(this.contentEl);
    okButton.setButtonText(this.okButtonText);
    okButton.setCta();
    okButton.onClick((event) => {
      this.handleOk(event, textComponent);
    });
    okButton.setClass(CssClass.OkButton);
    const cancelButton = new ButtonComponent(this.contentEl);
    cancelButton.setButtonText(this.cancelButtonText);
    cancelButton.onClick(this.close.bind(this));
    cancelButton.setClass(CssClass.CancelButton);
  }

  private handleOk(event: Event, textComponent: TextComponent): void {
    event.preventDefault();
    if (!textComponent.inputEl.checkValidity()) {
      this.markTouched(textComponent.inputEl);
      textComponent.inputEl.reportValidity();
      return;
    }

    this.isOkClicked = true;
    this.close();
  }

  private markTouched(inputEl: HTMLInputElement): void {
    this.isTouched = true;
    inputEl.removeClass(CssClass.Untouched);
  }
}

/**
 * Displays a prompt modal in Obsidian to get user input.
 *
 * @param params - The parameters for the prompt modal.
 * @returns A {@link Promise} that resolves with the user input or `null` if the prompt was cancelled.
 */
export async function prompt(params: PromptParams): Promise<null | string> {
  return await showModal<null | string>((promiseResolve) =>
    new PromptModal({
      ...params,
      promiseResolve
    })
  );
}
