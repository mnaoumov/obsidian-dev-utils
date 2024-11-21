/**
 * @packageDocumentation selectItem
 * Utility for displaying a selection modal in Obsidian.
 *
 * This module exports a function to display a modal that allows the user to select an item from a list. The modal uses fuzzy search to help the user find the item.
 */

import type { FuzzyMatch } from 'obsidian';

import {
  App,
  FuzzySuggestModal
} from 'obsidian';

/**
 * The parameters for the selection modal.
 */
export interface SelectItemOptions<T> {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The list of items to choose from.
   */
  items: T[];

  /**
   * A function to get the display text for each item
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

  public constructor(private options: SelectItemOptions<T>, private resolve: (item: null | T) => void) {
    super(options.app);
    this.setPlaceholder(options.placeholder ?? '');
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
 * @returns A promise that resolves with the selected item or null if no item was selected.
 */
export async function selectItem<T>(options: SelectItemOptions<T>): Promise<null | T> {
  return await new Promise<null | T>((resolve) => {
    const modal = new ItemSelectModal<T>(options, resolve);
    modal.open();
  });
}
