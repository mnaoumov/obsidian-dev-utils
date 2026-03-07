import type {
  EditorChange,
  EditorCommandName,
  EditorPosition,
  EditorRange,
  EditorSelection,
  EditorSelectionOrCaret,
  EditorTransaction
} from 'obsidian';
import type { CoordsLeftTop } from 'obsidian-typings';

import { noop } from '../../src/function.ts';

export abstract class Editor {
  private content = '';
  private readonly cursorPos: EditorPosition = { ch: 0, line: 0 };

  public blur(): void {
    noop();
  }

  public exec(_command: EditorCommandName): void {
    noop();
  }

  public focus(): void {
    noop();
  }

  public getCursor(_side?: 'anchor' | 'from' | 'head' | 'to'): EditorPosition {
    return { ...this.cursorPos };
  }

  public getDoc(): this {
    return this;
  }

  public getLine(_line: number): string {
    return '';
  }

  public getRange(_from: EditorPosition, _to: EditorPosition): string {
    return '';
  }

  public getScrollInfo(): CoordsLeftTop {
    return { left: 0, top: 0 };
  }

  public getSelection(): string {
    return '';
  }

  public getValue(): string {
    return this.content;
  }

  public hasFocus(): boolean {
    return false;
  }

  public lastLine(): number {
    return 0;
  }

  public lineCount(): number {
    return this.content.split('\n').length;
  }

  public listSelections(): EditorSelection[] {
    return [];
  }

  public offsetToPos(_offset: number): EditorPosition {
    return { ch: 0, line: 0 };
  }

  public posToOffset(_pos: EditorPosition): number {
    return 0;
  }

  public processLines<T>(
    _read: (line: number, lineText: string) => null | T,
    _write: (line: number, lineText: string, value: null | T) => EditorChange | undefined,
    _ignoreEmpty?: boolean
  ): void {
    noop();
  }

  public redo(): void {
    noop();
  }

  public refresh(): void {
    noop();
  }

  public replaceRange(_replacement: string, _from: EditorPosition, _to?: EditorPosition, _origin?: string): void {
    noop();
  }

  public replaceSelection(_replacement: string, _origin?: string): void {
    noop();
  }

  public scrollIntoView(_range: EditorRange, _center?: boolean): void {
    noop();
  }

  public scrollTo(_x?: null | number, _y?: null | number): void {
    noop();
  }

  public setCursor(_pos: EditorPosition | number, _ch?: number): void {
    noop();
  }

  public setLine(_n: number, _text: string): void {
    noop();
  }

  public setSelection(_anchor: EditorPosition, _head?: EditorPosition): void {
    noop();
  }

  public setSelections(_ranges: EditorSelectionOrCaret[], _main?: number): void {
    noop();
  }

  public setValue(content: string): void {
    this.content = content;
  }

  public somethingSelected(): boolean {
    return false;
  }

  public transaction(_tx: EditorTransaction, _origin?: string): void {
    noop();
  }

  public undo(): void {
    noop();
  }

  public wordAt(_pos: EditorPosition): EditorRange | null {
    return null;
  }
}
