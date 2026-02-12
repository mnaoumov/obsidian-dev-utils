import type { TFile } from './TFile.ts';

import { Events } from './Events.ts';

export class Workspace extends Events {
  activeEditor: unknown = null;
  activeLeaf: unknown = null;
  containerEl: HTMLElement = null as unknown as HTMLElement;
  layoutReady = false;
  leftRibbon: unknown = null;
  leftSplit: unknown = null;
  requestSaveLayout: unknown = null;
  rightRibbon: unknown = null;
  rightSplit: unknown = null;
  rootSplit: unknown = null;

  changeLayout(_workspace: unknown): Promise<void> {
    return Promise.resolve();
  }

  createLeafBySplit(_leaf: unknown, _direction?: string, _before?: boolean): unknown {
    return {};
  }

  createLeafInParent(_parent: unknown, _index: number): unknown {
    return {};
  }

  detachLeavesOfType(_viewType: string): void {}
  duplicateLeaf(_leaf: unknown, _leafType?: unknown, _direction?: string): Promise<unknown> {
    return Promise.resolve({});
  }

  ensureSideLeaf(_type: string, _side: string, _options?: unknown): Promise<unknown> {
    return Promise.resolve({});
  }

  getActiveFile(): null | TFile {
    return null;
  }

  getActiveViewOfType<T>(_type: new (...args: unknown[]) => T): null | T {
    return null;
  }

  getGroupLeaves(_group: string): unknown[] {
    return [];
  }

  getLastOpenFiles(): string[] {
    return [];
  }

  getLayout(): Record<string, unknown> {
    return {};
  }

  getLeaf(_newLeaf?: unknown): unknown {
    return {};
  }

  getLeafById(_id: string): unknown {
    return null;
  }

  getLeavesOfType(_viewType: string): unknown[] {
    return [];
  }

  getLeftLeaf(_split: boolean): unknown {
    return null;
  }

  getMostRecentLeaf(_root?: unknown): unknown {
    return null;
  }

  getRightLeaf(_split: boolean): unknown {
    return null;
  }

  getUnpinnedLeaf(): unknown {
    return {};
  }

  iterateAllLeaves(_callback: (leaf: unknown) => unknown): void {}
  iterateRootLeaves(_callback: (leaf: unknown) => unknown): void {}
  moveLeafToPopout(_leaf: unknown, _data?: unknown): unknown {
    return {};
  }

  onLayoutReady(_callback: () => unknown): void {}
  openLinkText(_linktext: string, _sourcePath: string, _newLeaf?: unknown, _openViewState?: unknown): Promise<void> {
    return Promise.resolve();
  }

  openPopoutLeaf(_data?: unknown): unknown {
    return {};
  }

  revealLeaf(_leaf: unknown): Promise<void> {
    return Promise.resolve();
  }

  setActiveLeaf(_leaf: unknown, _params?: unknown): void {}
  splitActiveLeaf(_direction?: string): unknown {
    return {};
  }

  updateOptions(): void {}
}
