import type { EventRef } from 'obsidian';

import type { TFile } from './TFile.ts';

export class MarkdownView {
  allowNoFile = false;
  app: unknown = null;
  containerEl: HTMLElement = null as unknown as HTMLElement;
  contentEl: HTMLElement = null as unknown as HTMLElement;
  currentMode: unknown = null;
  data = '';
  editor: unknown = {};
  file: null | TFile = null;
  hoverPopover: unknown = null;
  icon = '';
  leaf: unknown = null;
  navigation = true;
  previewMode: unknown = null;
  scope: unknown = null;
  addAction(_icon: string, _title: string, _callback: (evt: MouseEvent) => unknown): HTMLElement {
    return null as unknown as HTMLElement;
  }

  addChild<T>(component: T): T {
    return component;
  }

  canAcceptExtension(_extension: string): boolean {
    return false;
  }
  clear(): void {}
  getDisplayText(): string {
    return '';
  }
  getEphemeralState(): Record<string, unknown> {
    return {};
  }
  getIcon(): string {
    return this.icon;
  }
  getMode(): string {
    return 'source';
  }
  getState(): Record<string, unknown> {
    return {};
  }
  getViewData(): string {
    return this.data;
  }
  getViewType(): string {
    return 'markdown';
  }
  load(): void {}
  onload(): void {}
  onPaneMenu(_menu: unknown, _source: string): void {}
  onResize(): void {}
  onunload(): void {}
  register(_cb: () => unknown): void {}
  registerDomEvent(_el: unknown, _type: string, _callback: unknown, _options?: unknown): void {}
  registerEvent(_ref: EventRef): void {}
  registerInterval(_id: number): number {
    return _id;
  }
  removeChild<T>(component: T): T {
    return component;
  }
  requestSave: () => void = () => {};
  async save(_clear?: boolean): Promise<void> {}
  setEphemeralState(_state: unknown): void {}
  async setState(_state: unknown, _result: unknown): Promise<void> {}
  setViewData(_data: string, _clear: boolean): void {}
  showSearch(_replace?: boolean): void {}
  unload(): void {}
}
