/**
 * @packageDocumentation selectItem
 * Utility for displaying a selection modal in Obsidian.
 *
 * This module exports a function to display a modal that allows the user to select an item from a list. The modal uses fuzzy search to help the user find the item.
 */

import type { FuzzyMatch } from 'obsidian';
import {
  App,
  FuzzySuggestModal } from 'obsidian';

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

/**
 * Displays a selection modal in Obsidian for choosing an item from a list.
 *
 * @param params - The parameters for the selection modal.
 * @returns - A promise that resolves with the selected item or null if no item was selected.
 */
export async function selectItem<T>({
  app,
  items,
  itemTextFunc,
  placeholder = ''
}: SelectItemOptions<T>): Promise<T | null> {
  return await new Promise<T | null>((resolve) => {
    class ItemSelectModal extends FuzzySuggestModal<T> {
      private isSelected = false;

      public constructor() {
        super(app);
      }

      public override getItems(): T[] {
        return items;
      }

      public override getItemText(item: T): string {
        return itemTextFunc(item);
      }

      public override selectSuggestion(
        value: FuzzyMatch<T>,
        evt: MouseEvent | KeyboardEvent
      ): void {
        this.isSelected = true;
        super.selectSuggestion(value, evt);
      }

      public override onChooseItem(item: T): void {
        resolve(item);
      }

      public override onClose(): void {
        if (!this.isSelected) {
          resolve(null);
        }
      }
    }

    const modal = new ItemSelectModal();
    modal.setPlaceholder(placeholder);
    modal.open();
  });
}
