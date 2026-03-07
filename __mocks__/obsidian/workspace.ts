import type {
  Constructor,
  MarkdownFileInfo,
  OpenViewState,
  PaneType,
  Side,
  SplitDirection,
  View,
  WorkspaceParent,
  WorkspaceWindowInitData
} from 'obsidian';
import type {
  EnsureSideLeafOptions,
  SetActiveLeafParams
} from 'obsidian-typings';

import type { TFile } from './t-file.ts';

import {
  noop,
  noopAsync
} from '../../src/function.ts';
import { debounce } from './debounce.ts';
import { Events } from './events.ts';
import { WorkspaceLeaf } from './workspace-leaf.ts';
import { WorkspaceRibbon } from './workspace-ribbon.ts';
import { WorkspaceRoot } from './workspace-root.ts';
import { WorkspaceSidedock } from './workspace-sidedock.ts';
import { WorkspaceWindow } from './workspace-window.ts';

export class Workspace extends Events {
  public activeEditor: MarkdownFileInfo | null = null;
  public activeLeaf: null | WorkspaceLeaf = null;
  public layoutReady = false;
  public leftRibbon = new WorkspaceRibbon();
  public leftSplit = new WorkspaceSidedock();
  public requestSaveLayout = debounce(noop);
  public rightRibbon = new WorkspaceRibbon();
  public rightSplit = new WorkspaceSidedock();
  public rootSplit = new WorkspaceRoot();

  public get containerEl(): HTMLElement {
    this._containerEl ??= createDiv();
    return this._containerEl;
  }

  public set containerEl(el: HTMLElement) {
    this._containerEl = el;
  }

  private _containerEl?: HTMLElement;

  public async changeLayout(_workspace: unknown): Promise<void> {
    await noopAsync();
  }

  public createLeafBySplit(_leaf: WorkspaceLeaf, _direction?: SplitDirection, _before?: boolean): WorkspaceLeaf {
    return new WorkspaceLeaf();
  }

  public createLeafInParent(_parent: WorkspaceParent, _index: number): WorkspaceLeaf {
    return new WorkspaceLeaf();
  }

  public detachLeavesOfType(_viewType: string): void {
    noop();
  }

  public async duplicateLeaf(_leaf: WorkspaceLeaf, _leafType?: boolean | PaneType, _direction?: SplitDirection): Promise<WorkspaceLeaf> {
    await noopAsync();
    return new WorkspaceLeaf();
  }

  public async ensureSideLeaf(
    _type: string,
    _side: Side,
    _options?: EnsureSideLeafOptions
  ): Promise<WorkspaceLeaf> {
    await noopAsync();
    return new WorkspaceLeaf();
  }

  public getActiveFile(): null | TFile {
    return null;
  }

  public getActiveViewOfType<T extends View>(_type: Constructor<T>): null | T {
    return null;
  }

  public getGroupLeaves(_group: string): WorkspaceLeaf[] {
    return [];
  }

  public getLastOpenFiles(): string[] {
    return [];
  }

  public getLayout(): Record<string, unknown> {
    return {};
  }

  public getLeaf(_newLeaf?: boolean | PaneType): WorkspaceLeaf {
    return new WorkspaceLeaf();
  }

  public getLeafById(_id: string): null | WorkspaceLeaf {
    return null;
  }

  public getLeavesOfType(_viewType: string): WorkspaceLeaf[] {
    return [];
  }

  public getLeftLeaf(_split: boolean): null | WorkspaceLeaf {
    return null;
  }

  public getMostRecentLeaf(_root?: WorkspaceParent): null | WorkspaceLeaf {
    return null;
  }

  public getRightLeaf(_split: boolean): null | WorkspaceLeaf {
    return null;
  }

  public getUnpinnedLeaf(): WorkspaceLeaf {
    return new WorkspaceLeaf();
  }

  public iterateAllLeaves(_callback: (leaf: WorkspaceLeaf) => unknown): void {
    noop();
  }

  public iterateRootLeaves(_callback: (leaf: WorkspaceLeaf) => unknown): void {
    noop();
  }

  public moveLeafToPopout(_leaf: WorkspaceLeaf, _data?: WorkspaceWindowInitData): WorkspaceWindow {
    return new WorkspaceWindow();
  }

  public onLayoutReady(_callback: () => unknown): void {
    noop();
  }

  public async openLinkText(_linktext: string, _sourcePath: string, _newLeaf?: boolean | PaneType, _openViewState?: OpenViewState): Promise<void> {
    await noopAsync();
  }

  public openPopoutLeaf(_data?: WorkspaceWindowInitData): WorkspaceLeaf {
    return new WorkspaceLeaf();
  }

  public async revealLeaf(_leaf: WorkspaceLeaf): Promise<void> {
    await noopAsync();
  }

  public setActiveLeaf(_leaf: WorkspaceLeaf, _params?: SetActiveLeafParams): void {
    noop();
  }

  public splitActiveLeaf(_direction?: SplitDirection): WorkspaceLeaf {
    return new WorkspaceLeaf();
  }

  public updateOptions(): void {
    noop();
  }
}
