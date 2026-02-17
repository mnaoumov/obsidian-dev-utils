import { BaseComponent } from './BaseComponent.ts';

export abstract class ValueComponent<T> extends BaseComponent {
  /** @deprecated Mock-only abstract getter. inputEl is a concrete property in the Obsidian API. */
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Declaring mock-only abstract getter.
  public abstract get inputEl(): HTMLElement;

  /** @deprecated Mock-only constructor. ValueComponent has no public constructor in the Obsidian API. */
  public constructor() {
    super();
  }

  public abstract getValue(): T;

  public registerOptionListener(_listeners: Record<string, (value?: T) => T>, _key: string): this {
    return this;
  }

  public abstract setValue(value: T): this;
}
