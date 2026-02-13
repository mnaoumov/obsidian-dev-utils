import type {
  Command,
  PluginManifest
} from 'obsidian';

import type { App } from './App.ts';

import {
  noop,
  noopAsync
} from '../../src/Function.ts';
import { Component } from './Component.ts';

export class Plugin extends Component {
  public app: App = null as unknown as App;
  public manifest: PluginManifest = { author: '', description: '', id: '', minAppVersion: '', name: '', version: '' };

  public addCommand(command: Command): Command {
    return command;
  }

  public addRibbonIcon(_icon: string, _title: string, _callback: (evt: MouseEvent) => unknown): HTMLElement {
    return null as unknown as HTMLElement;
  }

  public addSettingTab(_settingTab: unknown): void {
    noop();
  }

  public addStatusBarItem(): HTMLElement {
    return null as unknown as HTMLElement;
  }

  public async loadData(): Promise<unknown> {
    await noopAsync();
    return {};
  }

  public onUserEnable(): void {
    noop();
  }

  public registerExtensions(_extensions: string[], _viewType: string): void {
    noop();
  }

  public registerHoverLinkSource(_id: string, _info: unknown): void {
    noop();
  }

  public registerMarkdownCodeBlockProcessor(_language: string, _handler: unknown, _sortOrder?: number): unknown {
    return {};
  }

  public registerMarkdownPostProcessor(_postProcessor: unknown, _sortOrder?: number): unknown {
    return {};
  }

  public registerView(_type: string, _viewCreator: unknown): void {
    noop();
  }

  public removeCommand(_commandId: string): void {
    noop();
  }

  public async saveData(_data: unknown): Promise<void> {
    await noopAsync();
  }
}
