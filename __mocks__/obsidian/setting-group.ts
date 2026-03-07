import type {
  ExtraButtonComponent,
  SearchComponent,
  Setting
} from 'obsidian';

import { noop } from '../../src/function.ts';

export class SettingGroup {
  public listEl: HTMLElement = createDiv();

  public constructor(_containerEl: HTMLElement) {
    noop();
  }

  public addClass(_cls: string): this {
    return this;
  }

  public addExtraButton(_cb: (component: ExtraButtonComponent) => unknown): this {
    return this;
  }

  public addSearch(_cb: (component: SearchComponent) => unknown): this {
    return this;
  }

  public addSetting(_cb: (setting: Setting) => void): this {
    return this;
  }

  public setHeading(_text: DocumentFragment | string): this {
    return this;
  }
}
