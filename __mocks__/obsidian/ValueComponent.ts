import { BaseComponent } from './BaseComponent.ts';

export class ValueComponent<T> extends BaseComponent {
  inputEl: HTMLElement = null as unknown as HTMLElement;
  protected value: T = undefined as unknown as T;

  getValue(): T {
    return this.value;
  }

  registerOptionListener(_listeners: Record<string, (value?: T) => T>, _key: string): this {
    return this;
  }

  setValue(value: T): this {
    this.value = value;
    return this;
  }
}
