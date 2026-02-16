import { BaseComponent } from './BaseComponent.ts';

export class TextAreaComponent extends BaseComponent {
  public inputEl: HTMLTextAreaElement;
  private changeCallback?: () => void;
  private value = '';

  public constructor(_containerEl: HTMLElement) {
    super();
    this.inputEl = document.createElement('textarea');
  }

  public getValue(): string {
    return this.value;
  }

  public onChange(cb: (value: string) => void): this {
    this.changeCallback = (): void => {
      cb(this.getValue());
    };
    return this;
  }

  public setPlaceholder(_placeholder: string): this {
    return this;
  }

  public setValue(value: string): this {
    this.value = value;
    this.inputEl.value = value;
    return this;
  }

  /** Test helper to trigger change callback. */
  public simulateChange(): void {
    this.changeCallback?.();
  }
}
