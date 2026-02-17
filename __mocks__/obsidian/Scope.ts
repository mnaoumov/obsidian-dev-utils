import type {
  KeymapEventHandler,
  KeymapEventListener,
  KeymapInfo,
  Modifier
} from 'obsidian';

import { noop } from '../../src/Function.ts';

interface MockKeyScope {
  func(): void;
  key: null | string;
  modifiers: null | string;
  scope: Scope;
}

export class Scope {
  public cb: (() => boolean) | undefined = undefined;
  public keys: MockKeyScope[] = [];
  public parent: Scope | undefined = undefined;
  public tabFocusContainerEl: HTMLElement | null = null;

  public constructor(_parent?: Scope) {
    this.parent = _parent;
  }

  public constructor__(_parent?: Scope): this {
    return this;
  }

  public handleKey(_event: KeyboardEvent, _keypress: KeymapInfo): unknown {
    return false;
  }

  public register(_modifiers: Modifier[] | null, _key: null | string, _func: KeymapEventListener): KeymapEventHandler {
    const handler = { key: _key, modifiers: _modifiers?.join(',') ?? null, scope: this };
    return handler;
  }

  public setTabFocusContainer(_container: HTMLElement): void {
    noop();
  }

  public unregister(_handler: KeymapEventHandler): void {
    noop();
  }
}
