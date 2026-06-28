/**
 * @file
 *
 * Utility for displaying a selection modal in Obsidian.
 *
 * This module exports a function to display a modal that allows the user to select an item from a list. The modal uses fuzzy search to help the user find the item.
 */

import type { FuzzyMatch } from 'obsidian';

import { FuzzySuggestModal } from 'obsidian';

import type { PromiseResolve } from '../../async.ts';
import type {
  ModalBaseConstructorParams,
  ModalParamsBase
} from './modal.ts';

import { CssClass } from '../../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';
import { showModal } from './modal.ts';

/**
 * Options for {@link selectItem}.
 *
 * @typeParam T - The type of the selectable items.
 */
export interface SelectItemParams<T> extends ModalParamsBase {
  /**
   * A list of items to choose from.
   */
  readonly items: T[];

  /**
   * Get the display text for each item
   *
   * @param item - The item to get the display text for.
   * @returns The display text for the item.
   */
  itemTextFunc(this: void, item: T): string;

  /**
   * A placeholder text for the input field.
   *
   * @default `''`
   */
  readonly placeholder?: string;
}

type ItemSelectModalConstructorParams<T> = ModalBaseConstructorParams<null | T> & SelectItemParams<T>;

class ItemSelectModal<T> extends FuzzySuggestModal<T> {
  private isSelected = false;
  private readonly items: T[];
  private readonly itemTextFunc: (this: void, item: T) => string;
  private readonly placeholder: string | undefined;
  private readonly promiseResolve: PromiseResolve<null | T>;

  public constructor(params: ItemSelectModalConstructorParams<T>) {
    super(params.app);
    this.items = params.items;
    this.itemTextFunc = params.itemTextFunc;
    this.placeholder = params.placeholder;
    this.promiseResolve = params.promiseResolve;

    this.setPlaceholder(this.placeholder ?? '');
    addPluginCssClasses(this.containerEl, params.cssClasses);
    addPluginCssClasses(this.containerEl, CssClass.SelectItemModal);
  }

  public override getItems(): T[] {
    return this.items;
  }

  public override getItemText(item: T): string {
    return this.itemTextFunc(item);
  }

  public override onChooseItem(item: T): void {
    this.promiseResolve(item);
  }

  public override onClose(): void {
    if (!this.isSelected) {
      this.promiseResolve(null);
    }
  }

  public override selectSuggestion(value: FuzzyMatch<T>, evt: KeyboardEvent | MouseEvent): void {
    this.isSelected = true;
    super.selectSuggestion(value, evt);
  }
}

/**
 * Displays a selection modal in Obsidian for choosing an item from a list.
 *
 * @typeParam T - The type of the selectable items.
 * @param params - The parameters for the selection modal.
 * @returns A {@link Promise} that resolves with the selected item or `null` if no item was selected.
 */
export async function selectItem<T>(params: SelectItemParams<T>): Promise<null | T> {
  return await showModal<null | T>((promiseResolve) =>
    new ItemSelectModal({
      ...params,
      promiseResolve
    })
  );
}
