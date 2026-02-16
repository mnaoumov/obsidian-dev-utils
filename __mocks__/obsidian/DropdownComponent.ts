import { BaseComponent } from './BaseComponent.ts';

export class DropdownComponent extends BaseComponent {
  public selectEl: HTMLSelectElement;
  private changeCallback?: () => void;

  public constructor(_containerEl: HTMLElement) {
    super();
    this.selectEl = document.createElement('select');
  }

  public addOption(value: string, display: string): this {
    const option = document.createElement('option');
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

  public getValue(): string {
    return this.selectEl.value;
  }

  public onChange(cb: (value: string) => void): this {
    this.changeCallback = (): void => {
      cb(this.getValue());
    };
    return this;
  }

  public setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }

  /** Test helper to trigger change callback. */
  public simulateChange(): void {
    this.changeCallback?.();
  }
}
