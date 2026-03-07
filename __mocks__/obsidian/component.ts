import type { EventRef } from 'obsidian';

import { noop } from '../../src/function.ts';

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

  public registerDomEvent<K extends keyof WindowEventMap>(
    el: Window,
    type: K,
    callback: (this: HTMLElement, ev: WindowEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean
  ): void;
  public registerDomEvent<K extends keyof DocumentEventMap>(
    el: Document,
    type: K,
    callback: (this: HTMLElement, ev: DocumentEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean
  ): void;
  public registerDomEvent<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean
  ): void;
  public registerDomEvent(_el: Document | HTMLElement | Window, _type: string, _callback: unknown, _options?: AddEventListenerOptions | boolean): void {
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
