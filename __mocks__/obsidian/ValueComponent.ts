import { BaseComponent } from './BaseComponent.ts';

export class ValueComponent<T> extends BaseComponent {
  declare public inputEl: HTMLElement;
  protected value: T = undefined as unknown as T;

  public getValue(): T {
    return this.value;
  }

  public registerOptionListener(_listeners: Record<string, (value?: T) => T>, _key: string): this {
    return this;
  }

  public setValue(value: T): this {
    this.value = value;
    return this;
  }
}
