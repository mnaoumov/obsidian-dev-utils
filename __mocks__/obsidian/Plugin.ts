import type {
  Command,
  HoverLinkSource,
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
  PluginManifest,
  PluginSettingTab,
  ViewCreator
} from 'obsidian';

import type { App } from './App.ts';

import {
  noop,
  noopAsync
} from '../../src/Function.ts';
import { Component } from './Component.ts';

export abstract class Plugin extends Component {
  public app: App;
  public manifest: PluginManifest;

  public constructor(app: App, manifest: PluginManifest) {
    super();
    this.app = app;
    this.manifest = manifest;
  }

  public addCommand(command: Command): Command {
    return command;
  }

  public addRibbonIcon(_icon: string, _title: string, _callback: (evt: MouseEvent) => unknown): HTMLElement {
    return createDiv();
  }

  public addSettingTab(_settingTab: PluginSettingTab): void {
    noop();
  }

  public addStatusBarItem(): HTMLElement {
    return createDiv();
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

  public registerHoverLinkSource(_id: string, _info: HoverLinkSource): void {
    noop();
  }

  public registerMarkdownCodeBlockProcessor(
    _language: string,
    _handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => unknown,
    _sortOrder?: number
  ): MarkdownPostProcessor {
    return noop;
  }

  public registerMarkdownPostProcessor(_postProcessor: MarkdownPostProcessor, _sortOrder?: number): MarkdownPostProcessor {
    return noop;
  }

  public registerView(_type: string, _viewCreator: ViewCreator): void {
    noop();
  }

  public removeCommand(_commandId: string): void {
    noop();
  }

  public async saveData(_data: unknown): Promise<void> {
    await noopAsync();
  }
}
