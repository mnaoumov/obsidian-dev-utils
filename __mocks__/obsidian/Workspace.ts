import type { TFile } from './TFile.ts';

import { Events } from './Events.ts';

export class Workspace extends Events {
  public activeEditor: unknown = null;
  public activeLeaf: unknown = null;
  public containerEl: HTMLElement = null as unknown as HTMLElement;
  public layoutReady = false;
  public leftRibbon: unknown = null;
  public leftSplit: unknown = null;
  public requestSaveLayout: unknown = null;
  public rightRibbon: unknown = null;
  public rightSplit: unknown = null;
  public rootSplit: unknown = null;

  public changeLayout(_workspace: unknown): Promise<void> {
    return Promise.resolve();
  }

  public createLeafBySplit(_leaf: unknown, _direction?: string, _before?: boolean): unknown {
    return {};
  }

  public createLeafInParent(_parent: unknown, _index: number): unknown {
    return {};
  }

  public detachLeavesOfType(_viewType: string): void {}
  public duplicateLeaf(_leaf: unknown, _leafType?: unknown, _direction?: string): Promise<unknown> {
    return Promise.resolve({});
  }

  public ensureSideLeaf(_type: string, _side: string, _options?: unknown): Promise<unknown> {
    return Promise.resolve({});
  }

  public getActiveFile(): null | TFile {
    return null;
  }

  public getActiveViewOfType<T>(_type: new (...args: unknown[]) => T): null | T {
    return null;
  }

  public getGroupLeaves(_group: string): unknown[] {
    return [];
  }

  public getLastOpenFiles(): string[] {
    return [];
  }

  public getLayout(): Record<string, unknown> {
    return {};
  }

  public getLeaf(_newLeaf?: unknown): unknown {
    return {};
  }

  public getLeafById(_id: string): unknown {
    return null;
  }

  public getLeavesOfType(_viewType: string): unknown[] {
    return [];
  }

  public getLeftLeaf(_split: boolean): unknown {
    return null;
  }

  public getMostRecentLeaf(_root?: unknown): unknown {
    return null;
  }

  public getRightLeaf(_split: boolean): unknown {
    return null;
  }

  public getUnpinnedLeaf(): unknown {
    return {};
  }

  public iterateAllLeaves(_callback: (leaf: unknown) => unknown): void {}
  public iterateRootLeaves(_callback: (leaf: unknown) => unknown): void {}
  public moveLeafToPopout(_leaf: unknown, _data?: unknown): unknown {
    return {};
  }

  public onLayoutReady(_callback: () => unknown): void {}
  public openLinkText(_linktext: string, _sourcePath: string, _newLeaf?: unknown, _openViewState?: unknown): Promise<void> {
    return Promise.resolve();
  }

  public openPopoutLeaf(_data?: unknown): unknown {
    return {};
  }

  public revealLeaf(_leaf: unknown): Promise<void> {
    return Promise.resolve();
  }

  public setActiveLeaf(_leaf: unknown, _params?: unknown): void {}
  public splitActiveLeaf(_direction?: string): unknown {
    return {};
  }

  public updateOptions(): void {}
}
