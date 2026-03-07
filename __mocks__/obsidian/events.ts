import type { EventRef } from 'obsidian';
import type { EventsEntry } from 'obsidian-typings';

import { noop } from '../../src/function.ts';

export class Events {
  public _: Record<string, EventsEntry[]> = {};

  public off(_name: string, _callback: (...data: unknown[]) => unknown): void {
    noop();
  }

  public offref(_ref: EventRef): void {
    noop();
  }

  public on(_name: string, _callback: (...data: unknown[]) => unknown, _ctx?: unknown): EventRef {
    return { e: this, fn: _callback, name: _name };
  }

  public trigger(_name: string, ..._data: unknown[]): void {
    noop();
  }

  public tryTrigger(_evt: EventRef, _args: unknown[]): void {
    noop();
  }
}
