import type {
  Component,
  EventRef,
  HoverPopover,
  IconName,
  Menu,
  ViewStateResult
} from 'obsidian';

import type { TFile } from './TFile.ts';

import {
  noop,
  noopAsync
} from '../../src/function.ts';
import { App } from './App.ts';
import { Editor } from './Editor.ts';
import { WorkspaceLeaf } from './WorkspaceLeaf.ts';

class MockEditor extends Editor {}

export class MarkdownView {
  public allowNoFile = false;
  public app = new App();
  public containerEl: HTMLElement = createDiv();
  public contentEl: HTMLElement = createDiv();
  public currentMode = {
    applyScroll: noop,
    get: (): string => '',
    getScroll: (): number => 0,
    set: noop
  };

  public data = '';
  public editor = new MockEditor();
  public file: null | TFile = null;
  public hoverPopover: HoverPopover | null = null;
  public icon: IconName = '';
  public leaf = new WorkspaceLeaf();
  public navigation = true;
  public previewMode = {
    applyScroll: noop,
    clear: noop,
    containerEl: createDiv(),
    get: (): string => '',
    getScroll: (): number => 0,
    rerender: noop,
    set: noop
  };

  public scope = null;

  public addAction(_icon: IconName, _title: string, _callback: (evt: MouseEvent) => unknown): HTMLElement {
    return createDiv();
  }

  public addChild<T extends Component>(component: T): T {
    return component;
  }

  public canAcceptExtension(_extension: string): boolean {
    return false;
  }

  public clear(): void {
    noop();
  }

  public getDisplayText(): string {
    return '';
  }

  public getEphemeralState(): Record<string, unknown> {
    return {};
  }

  public getIcon(): string {
    return this.icon;
  }

  public getMode(): 'preview' | 'source' {
    return 'source';
  }

  public getState(): Record<string, unknown> {
    return {};
  }

  public getViewData(): string {
    return this.data;
  }

  public getViewType(): string {
    return 'markdown';
  }

  public load(): void {
    noop();
  }

  public onload(): void {
    noop();
  }

  public onPaneMenu(_menu: Menu, _source: string): void {
    noop();
  }

  public onResize(): void {
    noop();
  }

  public onunload(): void {
    noop();
  }

  public register(_cb: () => unknown): void {
    noop();
  }

  public registerDomEvent(_el: Document | HTMLElement | Window, _type: string, _callback: unknown, _options?: AddEventListenerOptions | boolean): void {
    noop();
  }

  public registerEvent(_ref: EventRef): void {
    noop();
  }

  public registerInterval(_id: number): number {
    return _id;
  }

  public removeChild<T extends Component>(component: T): T {
    return component;
  }

  public requestSave(): void {
    noop();
  }

  public async save(_clear?: boolean): Promise<void> {
    await noopAsync();
  }

  public setEphemeralState(_state: unknown): void {
    noop();
  }

  public async setState(_state: unknown, _result: ViewStateResult): Promise<void> {
    await noopAsync();
  }

  public setViewData(_data: string, _clear: boolean): void {
    noop();
  }

  public showSearch(_replace?: boolean): void {
    noop();
  }

  public unload(): void {
    noop();
  }
}
