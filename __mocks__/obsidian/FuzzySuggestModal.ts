import type { App } from './App.ts';

import { noop } from '../../src/Function.ts';
import { Modal } from './Modal.ts';

export abstract class FuzzySuggestModal<T> extends Modal {
  public constructor(app: App) {
    super(app);
  }

  public getItems(): T[] {
    return [];
  }

  public getItemText(_item: T): string {
    return '';
  }

  public onChooseItem(_item: T, _evt: KeyboardEvent | MouseEvent): void {
    noop();
  }

  public selectSuggestion(value: { item: T }, evt: KeyboardEvent | MouseEvent): void {
    this.onChooseItem(value.item, evt);
    this.close();
  }

  public setPlaceholder(_placeholder: string): void {
    noop();
  }
}
