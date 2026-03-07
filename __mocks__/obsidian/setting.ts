import type {
  ButtonComponent,
  ColorComponent,
  DropdownComponent,
  ExtraButtonComponent,
  MomentFormatComponent,
  ProgressBarComponent,
  SearchComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ToggleComponent,
  TooltipOptions
} from 'obsidian';

import type { BaseComponent } from './base-component.ts';

import { noop } from '../../src/function.ts';

export class Setting {
  public components: BaseComponent[] = [];
  public controlEl: HTMLElement = createDiv();
  public descEl: HTMLElement = createDiv();
  public infoEl: HTMLElement = createDiv();
  public nameEl: HTMLElement = createDiv();
  public settingEl: HTMLElement = createDiv();

  public constructor(_containerEl: HTMLElement) {
    noop();
  }

  public addButton(_cb: (component: ButtonComponent) => unknown): this {
    return this;
  }

  public addColorPicker(_cb: (component: ColorComponent) => unknown): this {
    return this;
  }

  public addComponent(cb: (el: HTMLElement) => BaseComponent): this {
    const component = cb(this.controlEl);
    this.components.push(component);
    return this;
  }

  public addDropdown(_cb: (component: DropdownComponent) => unknown): this {
    return this;
  }

  public addExtraButton(_cb: (component: ExtraButtonComponent) => unknown): this {
    return this;
  }

  public addMomentFormat(_cb: (component: MomentFormatComponent) => unknown): this {
    return this;
  }

  public addProgressBar(_cb: (component: ProgressBarComponent) => unknown): this {
    return this;
  }

  public addSearch(_cb: (component: SearchComponent) => unknown): this {
    return this;
  }

  public addSlider(_cb: (component: SliderComponent) => unknown): this {
    return this;
  }

  public addText(_cb: (component: TextComponent) => unknown): this {
    return this;
  }

  public addTextArea(_cb: (component: TextAreaComponent) => unknown): this {
    return this;
  }

  public addToggle(_cb: (component: ToggleComponent) => unknown): this {
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

  public setTooltip(_tooltip: string, _options?: TooltipOptions): this {
    return this;
  }

  public then(cb: (setting: this) => unknown): this {
    cb(this);
    return this;
  }
}
