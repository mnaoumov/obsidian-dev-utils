import type { EventRef } from 'obsidian';

import { noop } from '../../src/Function.ts';

export class Component {
  public addChild<T extends Component>(component: T): T {
    return component;
  }

  public load(): void {
    noop();
  }

  public onload(): void {
    noop();
  }

  public onunload(): void {
    noop();
  }

  public register(_cb: () => unknown): void {
    noop();
  }

  public registerDomEvent(_el: unknown, _type: string, _callback: unknown, _options?: unknown): void {
    noop();
  }

  public registerEvent(_ref: EventRef): void {
    noop();
  }

  public registerInterval(_id: number): number {
    return _id;
  }

  public removeChild<T extends Component>(component: T): T {
    return component;
  }

  public unload(): void {
    noop();
  }
}
