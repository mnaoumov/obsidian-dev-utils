import type { TooltipOptions } from 'obsidian';

import { noop } from '../../src/function.ts';
import { ValueComponent } from './ValueComponent.ts';

export class ToggleComponent extends ValueComponent<boolean> {
  public toggleEl: HTMLElement;

  public override get inputEl(): HTMLElement {
    return this.toggleEl;
  }

  private _value = false;

  public constructor(_containerEl: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Calling mock-only @deprecated ValueComponent constructor.
    super();
    this.toggleEl = createDiv();
  }

  public override getValue(): boolean {
    return this._value;
  }

  public onChange(_callback: (value: boolean) => unknown): this {
    return this;
  }

  public onClick(): void {
    noop();
  }

  public setTooltip(_tooltip: string, _options?: TooltipOptions): this {
    return this;
  }

  public override setValue(value: boolean): this {
    this._value = value;
    return this;
  }
}
