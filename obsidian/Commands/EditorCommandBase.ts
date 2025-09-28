import type {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Menu,
  TFile
} from 'obsidian';

import type { Plugin } from '../Plugin.ts';

import {
  CommandBase,
  CommandInvocationBase
} from './CommandBase.ts';

export abstract class EditorCommandBase<TPlugin extends Plugin> extends CommandBase<TPlugin> {
  protected readonly menuItemName?: string;
  protected readonly menuSection?: string;

  public editorCheckCallback(checking: boolean, editor: Editor, ctx: MarkdownFileInfo | MarkdownView): boolean {
    return this.createEditorCommandInvocation(editor, ctx).invoke(checking);
  }

  public override register(): void {
    super.register();
    this.plugin.registerEvent(this.app.workspace.on('editor-menu', this.handleEditorMenu.bind(this)));
  }

  protected abstract createEditorCommandInvocation(editor: Editor, ctx: MarkdownFileInfo | MarkdownView): CommandInvocationBase;

  protected shouldAddToEditorMenu(_editor: Editor, _ctx: MarkdownFileInfo | MarkdownView): boolean {
    return false;
  }

  private handleEditorMenu(menu: Menu, editor: Editor, ctx: MarkdownFileInfo | MarkdownView): void {
    if (!this.createEditorCommandInvocation(editor, ctx).invoke(true)) {
      return;
    }

    if (!this.shouldAddToEditorMenu(editor, ctx)) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle(this.menuItemName ?? this.name)
        .setIcon(this.icon)
        .setSection(this.menuSection ?? '')
        .onClick(() => this.createEditorCommandInvocation(editor, ctx).invoke(false));
    });
  }
}

export class EditorCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  protected activeFile!: TFile;

  public constructor(plugin: TPlugin, protected readonly editor: Editor, protected readonly ctx: MarkdownFileInfo | MarkdownView) {
    super(plugin);
  }

  public override canExecute(): boolean {
    if (!super.canExecute()) {
      return false;
    }

    if (!this.ctx.file) {
      return false;
    }

    this.activeFile = this.ctx.file;
    return true;
  }
}
