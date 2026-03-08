import type {
  HoverPopover,
  IconName,
  OpenViewState,
  ViewState
} from 'obsidian';

import type { TFile } from './TFile.ts';

import {
  noop,
  noopAsync
} from '../../src/function.ts';
import { Events } from './Events.ts';

export class WorkspaceLeaf extends Events {
  public hoverPopover: HoverPopover | null = null;

  public readonly isDeferred = false;

  public detach(): void {
    noop();
  }

  public getDisplayText(): string {
    return '';
  }

  public getEphemeralState(): Record<string, unknown> {
    return {};
  }

  public getIcon(): IconName {
    return '';
  }

  public getViewState(): ViewState {
    return { type: '' };
  }

  public async loadIfDeferred(): Promise<void> {
    await noopAsync();
  }

  public onResize(): void {
    noop();
  }

  public async openFile(_file: TFile, _openState?: OpenViewState): Promise<void> {
    await noopAsync();
  }

  public setEphemeralState(_state: unknown): void {
    noop();
  }

  public setGroup(_group: string): void {
    noop();
  }

  public setGroupMember(_other: WorkspaceLeaf): void {
    noop();
  }

  public setPinned(_pinned: boolean): void {
    noop();
  }

  public async setViewState(_viewState: ViewState, _eState?: unknown): Promise<void> {
    await noopAsync();
  }

  public togglePinned(): void {
    noop();
  }
}
