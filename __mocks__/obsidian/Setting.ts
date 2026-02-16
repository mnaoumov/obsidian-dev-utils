import type { BaseComponent } from './BaseComponent.ts';

import { noop } from '../../src/Function.ts';

export class Setting {
  public components: BaseComponent[] = [];
  public controlEl: HTMLElement = {} as HTMLElement;
  public descEl: HTMLElement = {} as HTMLElement;
  public infoEl: HTMLElement = {} as HTMLElement;
  public nameEl: HTMLElement = {} as HTMLElement;
  public settingEl: HTMLElement = {} as HTMLElement;

  public constructor(_containerEl: HTMLElement) {
    noop();
  }

  public addButton(_cb: unknown): this {
    return this;
  }

  public addColorPicker(_cb: unknown): this {
    return this;
  }

  public addComponent(cb: (el: HTMLElement) => BaseComponent): this {
    const component = cb(this.controlEl);
    this.components.push(component);
    return this;
  }

  public addDropdown(_cb: unknown): this {
    return this;
  }

  public addExtraButton(_cb: unknown): this {
    return this;
  }

  public addMomentFormat(_cb: unknown): this {
    return this;
  }

  public addProgressBar(_cb: unknown): this {
    return this;
  }

  public addSearch(_cb: unknown): this {
    return this;
  }

  public addSlider(_cb: unknown): this {
    return this;
  }

  public addText(_cb: unknown): this {
    return this;
  }

  public addTextArea(_cb: unknown): this {
    return this;
  }

  public addToggle(_cb: unknown): this {
    return this;
  }

  public clear(): this {
    this.components = [];
    return this;
  }

  public setClass(_cls: string): this {
    return this;
  }

  public setDesc(_desc: DocumentFragment | string): this {
    return this;
  }

  public setDisabled(_disabled: boolean): this {
    return this;
  }

  public setHeading(): this {
    return this;
  }

  public setName(_name: DocumentFragment | string): this {
    return this;
  }

  public setTooltip(_tooltip: string): this {
    return this;
  }

  public then(cb: (setting: this) => unknown): this {
    cb(this);
    return this;
  }
}
