export class ValueComponent<T> {
  inputEl: HTMLElement = null as unknown as HTMLElement;
  protected value: T = undefined as unknown as T;
  getValue(): T {
    return this.value;
  }

  setValue(value: T): this {
    this.value = value;
    return this;
  }
}
