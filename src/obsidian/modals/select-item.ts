/**
 * @file
 *
 * Utility for displaying a selection modal in Obsidian.
 *
 * This module exports a function to display a modal that allows the user to select an item from a list. The modal uses fuzzy search to help the user find the item.
 */

import type {
  App,
  FuzzyMatch
} from 'obsidian';

import { FuzzySuggestModal } from 'obsidian';

import type { PromiseResolve } from '../../async.ts';

import { CssClass } from '../../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';
import { showModal } from './modal-base.ts';

/**
 * Options for {@link selectItem}.
 */
export interface SelectItemParams<T> {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A CSS class to apply to the modal.
   */
  readonly cssClass?: string;

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
  readonly itemTextFunc: (item: T) => string;

  /**
   * A placeholder text for the input field.
   */
  readonly placeholder?: string;
}

class ItemSelectModal<T> extends FuzzySuggestModal<T> {
  private isSelected = false;

  public constructor(private readonly params: SelectItemParams<T>, private readonly resolve: PromiseResolve<null | T>) {
    super(params.app);
    this.setPlaceholder(params.placeholder ?? '');
    addPluginCssClasses(this.containerEl, CssClass.SelectItemModal);
    if (params.cssClass) {
      this.containerEl.addClass(params.cssClass);
    }
  }

  public override getItems(): T[] {
    return this.params.items;
  }

  public override getItemText(item: T): string {
    return this.params.itemTextFunc(item);
  }

  public override onChooseItem(item: T): void {
    this.resolve(item);
  }

  public override onClose(): void {
    super.onClose();
    if (!this.isSelected) {
      this.resolve(null);
    }
  }

  public override selectSuggestion(
    value: FuzzyMatch<T>,
    evt: KeyboardEvent | MouseEvent
  ): void {
    this.isSelected = true;
    super.selectSuggestion(value, evt);
  }
}

/**
 * Displays a selection modal in Obsidian for choosing an item from a list.
 *
 * @param params - The parameters for the selection modal.
 * @returns A {@link Promise} that resolves with the selected item or `null` if no item was selected.
 */
export async function selectItem<T>(params: SelectItemParams<T>): Promise<null | T> {
  return await showModal<null | T>((resolve) => new ItemSelectModal(params, resolve));
}
