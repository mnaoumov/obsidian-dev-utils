import type {
  Command,
  PluginManifest
} from 'obsidian';

import type { App } from './App.ts';

import { Component } from './Component.ts';

export class Plugin extends Component {
  app: App = null as unknown as App;
  manifest: PluginManifest = { author: '', description: '', id: '', minAppVersion: '', name: '', version: '' };

  addCommand(command: Command): Command {
    return command;
  }

  addRibbonIcon(_icon: string, _title: string, _callback: (evt: MouseEvent) => unknown): HTMLElement {
    return null as unknown as HTMLElement;
  }

  addSettingTab(_settingTab: unknown): void {}

  addStatusBarItem(): HTMLElement {
    return null as unknown as HTMLElement;
  }

  async loadData(): Promise<unknown> {
    return {};
  }

  onUserEnable(): void {}

  registerExtensions(_extensions: string[], _viewType: string): void {}
  registerHoverLinkSource(_id: string, _info: unknown): void {}

  registerMarkdownCodeBlockProcessor(_language: string, _handler: unknown, _sortOrder?: number): unknown {
    return {};
  }

  registerMarkdownPostProcessor(_postProcessor: unknown, _sortOrder?: number): unknown {
    return {};
  }

  registerView(_type: string, _viewCreator: unknown): void {}
  removeCommand(_commandId: string): void {}

  async saveData(_data: unknown): Promise<void> {}
}
