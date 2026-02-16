import { BaseComponent } from './BaseComponent.ts';

export class ButtonComponent extends BaseComponent {
  public static instances: ButtonComponent[] = [];
  public buttonEl: HTMLButtonElement = {} as HTMLButtonElement;
  private clickHandler?: (evt: Event) => void;

  public constructor(_containerEl: HTMLElement) {
    super();
    ButtonComponent.instances.push(this);
  }

  public onClick(cb: (evt: Event) => void): this {
    this.clickHandler = cb;
    return this;
  }

  public setButtonText(_text: string): this {
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

  public setTooltip(_tooltip: string): this {
    return this;
  }

  public setWarning(): this {
    return this;
  }

  /** Test helper to simulate a click. */
  public simulateClick(): void {
    this.clickHandler?.(new Event('click'));
  }
}
