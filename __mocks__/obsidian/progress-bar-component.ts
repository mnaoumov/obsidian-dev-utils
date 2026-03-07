import { ValueComponent } from './value-component.ts';

export class ProgressBarComponent extends ValueComponent<number> {
  public progressBar: HTMLElement;

  public override get inputEl(): HTMLElement {
    return this.progressBar;
  }

  private _value = 0;

  public constructor(_containerEl: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated ValueComponent constructor.
    super();
    this.progressBar = createDiv();
  }

  public override getValue(): number {
    return this._value;
  }

  public override setValue(value: number): this {
    this._value = value;
    return this;
  }
}
