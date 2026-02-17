import { noop } from '../../src/Function.ts';
import { castTo } from '../../src/ObjectUtils.ts';
import { BaseComponent } from './BaseComponent.ts';

export class AbstractTextComponent<T extends HTMLInputElement | HTMLTextAreaElement> extends BaseComponent {
  public inputEl: T;
  private value = '';

  public constructor(_containerEl: HTMLElement) {
    super();
    this.inputEl = castTo<T>(document.createElement('input'));
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
