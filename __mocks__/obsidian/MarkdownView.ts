import type { EventRef } from 'obsidian';

import type { TFile } from './TFile.ts';

import {
  noop,
  noopAsync
} from '../../src/Function.ts';

export class MarkdownView {
  public allowNoFile = false;
  public app: unknown = null;
  public containerEl: HTMLElement = null as unknown as HTMLElement;
  public contentEl: HTMLElement = null as unknown as HTMLElement;
  public currentMode: unknown = null;
  public data = '';
  public editor: unknown = {};
  public file: null | TFile = null;
  public hoverPopover: unknown = null;
  public icon = '';
  public leaf: unknown = null;
  public navigation = true;
  public previewMode: unknown = null;
  public scope: unknown = null;
  public addAction(_icon: string, _title: string, _callback: (evt: MouseEvent) => unknown): HTMLElement {
    return null as unknown as HTMLElement;
  }

  public addChild<T>(component: T): T {
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

  public getMode(): string {
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

  public onPaneMenu(_menu: unknown, _source: string): void {
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

  public registerDomEvent(_el: unknown, _type: string, _callback: unknown, _options?: unknown): void {
    noop();
  }

  public registerEvent(_ref: EventRef): void {
    noop();
  }

  public registerInterval(_id: number): number {
    return _id;
  }

  public removeChild<T>(component: T): T {
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

  public async setState(_state: unknown, _result: unknown): Promise<void> {
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
