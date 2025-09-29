import type {
  Menu,
  Plugin,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { TFile } from 'obsidian';

import { CommandInvocationBase } from './CommandBase.ts';
import { NonEditorCommandBase } from './NonEditorCommandBase.ts';

export abstract class FileCommandBase<TPlugin extends Plugin = Plugin> extends NonEditorCommandBase<TPlugin> {
  protected readonly menuItemName?: string;
  protected readonly menuSection?: string;

  public override register(): void {
    super.register();
    this.plugin.registerEvent(this.app.workspace.on('file-menu', this.handleFileMenu.bind(this)));
  }

  protected abstract override createCommandInvocation(): FileCommandInvocationBase<TPlugin>;

  protected shouldAddToFileMenu(_file: TFile, _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }

  private handleFileMenu(menu: Menu, file: TAbstractFile, source: string, leaf?: WorkspaceLeaf): void {
    if (!(file instanceof TFile)) {
      return;
    }

    if (!this.createCommandInvocation().invoke(true)) {
      return;
    }

    if (!this.shouldAddToFileMenu(file, source, leaf)) {
      return;
    }

    menu.addItem((item) => {
      item.setTitle(this.menuItemName ?? this.name)
        .setIcon(this.icon)
        .onClick(() => this.createCommandInvocation().invoke(false, file));

      if (this.menuSection) {
        item.setSection(this.menuSection);
      }
    });
  }
}

export abstract class FileCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  protected file!: TFile;

  public override invoke(checking: boolean, file?: TFile): boolean {
    if (file) {
      this.file = file;
    }
    return super.invoke(checking);
  }

  protected override canExecute(): boolean {
    const file = (this.file as TFile | undefined) ?? this.app.workspace.getActiveFile();
    if (!file) {
      return false;
    }
    this.file = file;
    return true;
  }
}
