import type { EventRef } from 'obsidian';

export class Events {
  off(_name: string, _callback: (...data: unknown[]) => unknown): void {}

  offref(_ref: EventRef): void {}
  on(_name: string, _callback: (...data: unknown[]) => unknown, _ctx?: unknown): EventRef {
    return { e: this, fn: _callback, name: _name } as unknown as EventRef;
  }

  trigger(_name: string, ..._data: unknown[]): void {}
  tryTrigger(_evt: EventRef, _args: unknown[]): void {}
}
