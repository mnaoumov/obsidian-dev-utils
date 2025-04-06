/**
 * @packageDocumentation
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

import type { PromiseResolve } from '../../Async.ts';

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';
import { showModal } from './ModalBase.ts';

/**
 * The parameters for the selection modal.
 */
export interface SelectItemOptions<T> {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The CSS class to apply to the modal.
   */
  cssClass?: string;

  /**
   * The list of items to choose from.
   */
  items: T[];

  /**
   * A function to get the display text for each item
   *
   * @param item - The item to get the display text for.
   * @returns The display text for the item.
   */
  itemTextFunc: (item: T) => string;

  /**
   * The placeholder text for the input field.
   */
  placeholder?: string;
}

class ItemSelectModal<T> extends FuzzySuggestModal<T> {
  private isSelected = false;

  public constructor(private options: SelectItemOptions<T>, private resolve: PromiseResolve<null | T>) {
    super(options.app);
    this.setPlaceholder(options.placeholder ?? '');
    this.containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.SelectItemModal);
    if (options.cssClass) {
      this.containerEl.addClass(options.cssClass);
    }
  }

  public override getItems(): T[] {
    return this.options.items;
  }

  public override getItemText(item: T): string {
    return this.options.itemTextFunc(item);
  }

  public override onChooseItem(item: T): void {
    this.resolve(item);
  }

  public override onClose(): void {
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
 * @param options - The options for the selection modal.
 * @returns A {@link Promise} that resolves with the selected item or null if no item was selected.
 */
export async function selectItem<T>(options: SelectItemOptions<T>): Promise<null | T> {
  return await showModal<null | T>((resolve) => new ItemSelectModal(options, resolve));
}
