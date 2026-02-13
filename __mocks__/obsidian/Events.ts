import type { EventRef } from 'obsidian';

import { noop } from '../../src/Function.ts';

export class Events {
  public off(_name: string, _callback: (...data: unknown[]) => unknown): void {
    noop();
  }

  public offref(_ref: EventRef): void {
    noop();
  }

  public on(_name: string, _callback: (...data: unknown[]) => unknown, _ctx?: unknown): EventRef {
    return { e: this, fn: _callback, name: _name } as unknown as EventRef;
  }

  public trigger(_name: string, ..._data: unknown[]): void {
    noop();
  }

  public tryTrigger(_evt: EventRef, _args: unknown[]): void {
    noop();
  }
}
