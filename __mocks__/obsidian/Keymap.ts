import type {
  Modifier,
  PaneType,
  UserEvent
} from 'obsidian';

import type { Scope } from './Scope.ts';

import { noop } from '../../src/function.ts';

export class Keymap {
  public static isModEvent(_evt?: null | UserEvent): boolean | PaneType {
    return false;
  }

  public static isModifier(_evt: KeyboardEvent | MouseEvent | TouchEvent, _modifier: Modifier): boolean {
    return false;
  }

  public popScope(_scope: Scope): void {
    noop();
  }

  public pushScope(_scope: Scope): void {
    noop();
  }
}
