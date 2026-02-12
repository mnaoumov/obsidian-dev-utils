import type { Scope } from './Scope.ts';

export class Keymap {
  static isModEvent(_evt?: unknown): boolean | string {
    return false;
  }

  static isModifier(_evt: KeyboardEvent | MouseEvent | TouchEvent, _modifier: string): boolean {
    return false;
  }

  popScope(_scope: Scope): void {}

  pushScope(_scope: Scope): void {}
}
