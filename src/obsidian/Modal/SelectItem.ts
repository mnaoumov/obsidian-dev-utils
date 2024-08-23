/**
 * @module selectItem
 * Utility for displaying a selection modal in Obsidian.
 *
 * This module exports a function to display a modal that allows the user to select an item from a list. The modal uses fuzzy search to help the user find the item.
 */

import {
  App,
  FuzzySuggestModal,
  type FuzzyMatch
} from "obsidian";

/**
 * Displays a selection modal in Obsidian for choosing an item from a list.
 *
 * @param {Object} params - The parameters for the selection modal.
 * @param {App} params.app - The Obsidian app instance.
 * @param {T[]} params.items - The list of items to choose from.
 * @param {(item: T) => string} params.itemTextFunc - A function to get the display text for each item.
 * @param {string} [params.placeholder] - The placeholder text for the input field.
 * @returns {Promise<T | null>} - A promise that resolves with the selected item or null if no item was selected.
 */
export async function selectItem<T>({
  app,
  items,
  itemTextFunc,
  placeholder = ""
}: {
  app: App;
  items: T[];
  itemTextFunc(item: T): string;
  placeholder?: string;
}): Promise<T | null> {
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
        evt: MouseEvent | KeyboardEvent,
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
