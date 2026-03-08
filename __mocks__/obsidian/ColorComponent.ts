import type {
  HSL,
  RGB
} from 'obsidian';

import { ValueComponent } from './ValueComponent.ts';

export class ColorComponent extends ValueComponent<string> {
  public colorPickerEl: HTMLInputElement;

  public override get inputEl(): HTMLInputElement {
    return this.colorPickerEl;
  }

  private _value = '';

  public constructor(_containerEl: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated ValueComponent constructor.
    super();
    this.colorPickerEl = createEl('input');
    this.colorPickerEl.type = 'color';
  }

  public override getValue(): string {
    return this._value;
  }

  public getValueHsl(): HSL {
    return { h: 0, l: 0, s: 0 };
  }

  public getValueRgb(): RGB {
    return { b: 0, g: 0, r: 0 };
  }

  public onChange(_callback: (value: string) => unknown): this {
    return this;
  }

  public override setValue(value: string): this {
    this._value = value;
    return this;
  }

  public setValueHsl(_hsl: HSL): this {
    return this;
  }

  public setValueRgb(_rgb: RGB): this {
    return this;
  }
}
