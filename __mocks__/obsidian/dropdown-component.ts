import { ValueComponent } from './value-component.ts';

export class DropdownComponent extends ValueComponent<string> {
  public selectEl: HTMLSelectElement;

  public override get inputEl(): HTMLSelectElement {
    return this.selectEl;
  }

  private changeCallback?: () => void;

  public constructor(_containerEl: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated ValueComponent constructor.
    super();
    this.selectEl = createEl('select');
  }

  public addOption(value: string, display: string): this {
    const option = createEl('option');
    option.value = value;
    option.text = display;
    this.selectEl.appendChild(option);
    return this;
  }

  public addOptions(options: Record<string, string>): this {
    for (const [value, display] of Object.entries(options)) {
      this.addOption(value, display);
    }
    return this;
  }

  public override getValue(): string {
    return this.selectEl.value;
  }

  public onChange(cb: (value: string) => void): this {
    this.changeCallback = (): void => {
      cb(this.getValue());
    };
    return this;
  }

  public override setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }

  /** Test helper to trigger change callback. */
  public simulateChange(): void {
    this.changeCallback?.();
  }
}
