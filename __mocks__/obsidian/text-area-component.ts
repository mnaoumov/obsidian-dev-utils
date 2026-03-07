import { AbstractTextComponent } from './abstract-text-component.ts';

export class TextAreaComponent extends AbstractTextComponent<HTMLTextAreaElement> {
  private changeCallback?: () => void;

  public constructor(_containerEl: HTMLElement) {
    super(createEl('textarea'));
  }

  public override onChange(cb: (value: string) => void): this {
    this.changeCallback = (): void => {
      cb(this.getValue());
    };
    return this;
  }

  public override setValue(value: string): this {
    super.setValue(value);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Accessing mock-only @deprecated inputEl.
    this.inputEl.value = value;
    return this;
  }

  /** @deprecated Mock-only. Triggers the registered change callback. Not part of the Obsidian API. */
  public simulateChange(): void {
    this.changeCallback?.();
  }
}
