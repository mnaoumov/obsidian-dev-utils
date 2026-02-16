import { noop } from '../../src/Function.ts';
import { ValueComponent } from './ValueComponent.ts';

export class TextComponent extends ValueComponent<string> {
  public static instances: TextComponent[] = [];
  public eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  public override inputEl: HTMLInputElement;

  public constructor(_containerEl: HTMLElement) {
    super();
    this.value = '';
    const eventListeners = this.eventListeners;
    this.inputEl = {
      addClass(): void {
        noop();
      },
      addEventListener(event: string, handler: (...args: unknown[]) => void): void {
        eventListeners[event] ??= [];
        eventListeners[event].push(handler);
      },
      checkValidity: (): boolean => true,
      reportValidity: (): boolean => true,
      select(): void {
        noop();
      },
      setCustomValidity(): void {
        noop();
      },
      value: ''
    } as unknown as HTMLInputElement;
    TextComponent.instances.push(this);
  }

  public onChange(cb: (value: string) => void): this {
    cb(this.value);
    return this;
  }

  public onChanged(): void {
    noop();
  }

  public setPlaceholder(_placeholder: string): this {
    return this;
  }

  /** Test helper to simulate a DOM event on inputEl. */
  public simulateEvent(event: string, ...args: unknown[]): void {
    for (const handler of this.eventListeners[event] ?? []) {
      handler(...args);
    }
  }
}
