import type { TooltipOptions } from 'obsidian';

import { BaseComponent } from './BaseComponent.ts';

export class ButtonComponent extends BaseComponent {
  /** @deprecated Mock-only. Tracks all created instances for test assertions. Not part of the Obsidian API. */
  public static instances: ButtonComponent[] = [];
  public buttonEl: HTMLButtonElement = createEl('button');
  private clickHandler?: (evt: MouseEvent) => unknown;

  public constructor(_containerEl: HTMLElement) {
    super();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Initializing mock-only tracking field.
    ButtonComponent.instances.push(this);
  }

  public onClick(callback: (evt: MouseEvent) => unknown): this {
    this.clickHandler = callback;
    return this;
  }

  public removeCta(): this {
    return this;
  }

  public setButtonText(_name: string): this {
    return this;
  }

  public setClass(_cls: string): this {
    return this;
  }

  public setCta(): this {
    return this;
  }

  public setIcon(_icon: string): this {
    return this;
  }

  public setTooltip(_tooltip: string, _options?: TooltipOptions): this {
    return this;
  }

  public setWarning(): this {
    return this;
  }

  /** @deprecated Mock-only. Simulates a button click by invoking the registered click handler. Not part of the Obsidian API. */
  public simulateClick(): void {
    this.clickHandler?.(new Event('click') as MouseEvent);
  }
}
