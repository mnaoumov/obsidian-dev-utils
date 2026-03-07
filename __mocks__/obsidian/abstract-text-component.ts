import { ValueComponent } from './value-component.ts';

export abstract class AbstractTextComponent<T extends HTMLInputElement | HTMLTextAreaElement> extends ValueComponent<string> {
  public override inputEl: T;

  private _value = '';

  public constructor(_inputEl: T) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated ValueComponent constructor.
    super();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Assigning mock-only @deprecated inputEl.
    this.inputEl = _inputEl;
  }

  public override getValue(): string {
    return this._value;
  }

  public onChange(_callback: (value: string) => unknown): this {
    return this;
  }

  public onChanged(): void {
    // Noop
  }

  public setPlaceholder(_placeholder: string): this {
    return this;
  }

  public override setValue(value: string): this {
    this._value = value;
    return this;
  }
}
