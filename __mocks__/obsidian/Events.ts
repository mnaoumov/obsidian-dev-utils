import type { EventRef } from 'obsidian';

export class Events {
  public off(_name: string, _callback: (...data: unknown[]) => unknown): void {}

  public offref(_ref: EventRef): void {}
  public on(_name: string, _callback: (...data: unknown[]) => unknown, _ctx?: unknown): EventRef {
    return { e: this, fn: _callback, name: _name } as unknown as EventRef;
  }

  public trigger(_name: string, ..._data: unknown[]): void {}
  public tryTrigger(_evt: EventRef, _args: unknown[]): void {}
}
