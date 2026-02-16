import { noop } from '../../src/Function.ts';

export class SettingGroup {
  public listEl: HTMLElement = {} as HTMLElement;

  public constructor(_containerEl: HTMLElement) {
    noop();
  }

  public addClass(_cls: string): this {
    return this;
  }

  public addExtraButton(_cb: unknown): this {
    return this;
  }

  public addSearch(_cb: unknown): this {
    return this;
  }

  public addSetting(_cb: unknown): this {
    return this;
  }

  public setHeading(_text: DocumentFragment | string): this {
    return this;
  }
}
