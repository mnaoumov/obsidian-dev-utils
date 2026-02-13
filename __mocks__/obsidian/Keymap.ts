import type { Scope } from './Scope.ts';

import { noop } from '../../src/Function.ts';

export class Keymap {
  public static isModEvent(_evt?: unknown): boolean | string {
    return false;
  }

  public static isModifier(_evt: KeyboardEvent | MouseEvent | TouchEvent, _modifier: string): boolean {
    return false;
  }

  public popScope(_scope: Scope): void {
    noop();
  }

  public pushScope(_scope: Scope): void {
    noop();
  }
}
