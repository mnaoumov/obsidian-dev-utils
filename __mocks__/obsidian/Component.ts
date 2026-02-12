import type { EventRef } from 'obsidian';

export class Component {
  addChild<T extends Component>(component: T): T {
    return component;
  }
  load(): void {}
  onload(): void {}
  onunload(): void {}
  register(_cb: () => unknown): void {}
  registerDomEvent(_el: unknown, _type: string, _callback: unknown, _options?: unknown): void {}
  registerEvent(_ref: EventRef): void {}
  registerInterval(_id: number): number {
    return _id;
  }
  removeChild<T extends Component>(component: T): T {
    return component;
  }
  unload(): void {}
}
