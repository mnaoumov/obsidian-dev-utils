import { noop } from '../../src/Function.ts';
import { Modal } from './Modal.ts';

export class FuzzySuggestModal<T> extends Modal {
  public constructor(app: unknown) {
    super(app);
  }

  public getItems(): T[] {
    return [];
  }

  public getItemText(_item: T): string {
    return '';
  }

  public onChooseItem(_item: T, _evt: Event | KeyboardEvent | MouseEvent): void {
    noop();
  }

  public selectSuggestion(value: { item: T }, evt: Event | KeyboardEvent | MouseEvent): void {
    this.onChooseItem(value.item, evt);
    this.close();
  }

  public setPlaceholder(_placeholder: string): void {
    noop();
  }
}
