import { noop } from '../../src/function.ts';
import { ValueComponent } from './value-component.ts';

export class SliderComponent extends ValueComponent<number> {
  public sliderEl: HTMLInputElement;

  public override get inputEl(): HTMLInputElement {
    return this.sliderEl;
  }

  private _value = 0;

  public constructor(_containerEl: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated ValueComponent constructor.
    super();
    this.sliderEl = createEl('input');
    this.sliderEl.type = 'range';
  }

  public override getValue(): number {
    return this._value;
  }

  public getValuePretty(): string {
    return '';
  }

  public onChange(_callback: (value: number) => unknown): this {
    return this;
  }

  public setDynamicTooltip(): this {
    return this;
  }

  public setInstant(_instant: boolean): this {
    return this;
  }

  public setLimits(_min: null | number, _max: null | number, _step: 'any' | number): this {
    return this;
  }

  public override setValue(value: number): this {
    this._value = value;
    return this;
  }

  public showTooltip(): void {
    noop();
  }
}
