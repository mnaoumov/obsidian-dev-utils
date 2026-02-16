import { noop } from '../../src/Function.ts';
import { BaseComponent } from './BaseComponent.ts';

export class AbstractTextComponent<T extends HTMLInputElement | HTMLTextAreaElement> extends BaseComponent {
  public inputEl: T;
  private value = '';

  public constructor(_containerEl: HTMLElement) {
    super();
    this.inputEl = document.createElement('input') as unknown as T;
  }

  public getValue(): string {
    return this.value;
  }

  public onChanged(): void {
    noop();
  }

  public setPlaceholder(_placeholder: string): this {
    return this;
  }

  public setValue(value: string): this {
    this.value = value;
    return this;
  }
}
