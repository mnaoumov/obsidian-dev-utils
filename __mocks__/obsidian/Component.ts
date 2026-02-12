import type { EventRef } from 'obsidian';

export class Component {
  public addChild<T extends Component>(component: T): T {
    return component;
  }

  public load(): void {}
  public onload(): void {}
  public onunload(): void {}
  public register(_cb: () => unknown): void {}
  public registerDomEvent(_el: unknown, _type: string, _callback: unknown, _options?: unknown): void {}
  public registerEvent(_ref: EventRef): void {}
  public registerInterval(_id: number): number {
    return _id;
  }

  public removeChild<T extends Component>(component: T): T {
    return component;
  }

  public unload(): void {}
}
