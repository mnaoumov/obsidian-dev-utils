/**
 * @file
 *
 * Utility for displaying a modal that offers a fixed set of labelled options as buttons.
 *
 * Unlike {@link selectItem} (a fuzzy-search picker over an arbitrary list), this modal renders one
 * button per option — useful for a small, fixed set of mutually-exclusive choices where each choice
 * has its own label and resolved value. It resolves with the chosen value, or `null` if the modal is
 * dismissed without a choice.
 */

import { ButtonComponent } from 'obsidian';

import type {
  ModalBaseConstructorParams,
  ModalParamsBase
} from './modal.ts';

import { CssClass } from '../css-class.ts';
import {
  ModalBase,
  showModal
} from './modal.ts';

/**
 * A single selectable option rendered as a button in the {@link selectOption} modal.
 *
 * @typeParam T - The type of the value resolved when this option is chosen.
 */
export interface SelectOptionItem<T> {
  /**
   * Whether to render this option as the call-to-action (primary) button.
   *
   * @default `false`
   */
  readonly isCta?: boolean;

  /**
   * The button label.
   */
  readonly text: string;

  /**
   * The value the modal resolves with when this option is chosen.
   */
  readonly value: T;
}

/**
 * Parameters for {@link selectOption}.
 *
 * @typeParam T - The type of the value resolved when an option is chosen.
 */
export interface SelectOptionParams<T> extends ModalParamsBase {
  /**
   * A message displayed above the option buttons.
   *
   * @default `''`
   */
  readonly message?: DocumentFragment | string;

  /**
   * The selectable options, each rendered as a button.
   */
  readonly options: SelectOptionItem<T>[];

  /**
   * A title of the modal.
   *
   * @default `''`
   */
  readonly title?: DocumentFragment | string;
}

type SelectOptionModalConstructorParams<T> = ModalBaseConstructorParams<null | T> & SelectOptionParams<T>;

class SelectOptionModal<T> extends ModalBase<null | T> {
  private isSelected = false;
  private readonly message: DocumentFragment | string;
  private readonly options: SelectOptionItem<T>[];
  private readonly title: DocumentFragment | string;

  public constructor(params: SelectOptionModalConstructorParams<T>) {
    super(params);
    this.addCssClasses(CssClass.SelectOptionModal);
    this.message = params.message ?? '';
    this.options = params.options;
    this.title = params.title ?? '';
  }

  public override onClose(): void {
    if (!this.isSelected) {
      this.promiseResolve(null);
    }
  }

  public override onOpen(): void {
    this.titleEl.setText(this.title);
    if (this.message) {
      this.contentEl.createEl('p', { text: this.message });
    }

    for (const option of this.options) {
      const button = new ButtonComponent(this.contentEl);
      button.setButtonText(option.text);
      if (option.isCta) {
        button.setCta();
      }
      button.onClick(() => {
        this.isSelected = true;
        this.promiseResolve(option.value);
        this.close();
      });
    }
  }
}

/**
 * Displays a modal in Obsidian offering a fixed set of labelled options as buttons.
 *
 * @typeParam T - The type of the value resolved when an option is chosen.
 * @param params - The parameters for the modal.
 * @returns A {@link Promise} that resolves with the chosen option's value, or `null` if the modal
 * was dismissed without a choice.
 */
export async function selectOption<T>(params: SelectOptionParams<T>): Promise<null | T> {
  return await showModal<null | T>((promiseResolve) =>
    new SelectOptionModal<T>({
      ...params,
      promiseResolve
    })
  );
}
