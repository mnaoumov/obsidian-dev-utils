/**
 * @packageDocumentation
 *
 * Base classes for file commands.
 */

import type {
  Menu,
  Plugin,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { TFile } from 'obsidian';

import { CommandInvocationBase } from './CommandBase.ts';
import { NonEditorCommandBase } from './NonEditorCommandBase.ts';

/**
 * Base class for file commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FileCommandBase<TPlugin extends Plugin = Plugin> extends NonEditorCommandBase<TPlugin> {
  protected readonly menuItemName?: string;
  protected readonly menuSection?: string;

  /**
   * Registers the command.
   */
  public override register(): void {
    super.register();
    this.plugin.registerEvent(this.app.workspace.on('file-menu', this.handleFileMenu.bind(this)));
  }

  /**
   * Creates a new file command invocation.
   *
   * @returns The command invocation.
   */
  protected abstract override createCommandInvocation(): FileCommandInvocationBase<TPlugin>;

  /**
   * Checks if the command should be added to the file menu.
   *
   * @param _file - The file to check.
   * @param _source - The source of the file.
   * @param _leaf - The leaf to check.
   * @returns Whether the command should be added to the file menu.
   */
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

/**
 * Base class for file command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FileCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  protected file!: TFile;

  /**
   * Invokes the command.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @param file - The file to invoke the command for.
   * @returns Whether the command was executed.
   */
  public override invoke(checking: boolean, file?: TFile): boolean {
    if (file) {
      this.file = file;
    }
    return super.invoke(checking);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    const file = (this.file as TFile | undefined) ?? this.app.workspace.getActiveFile();
    if (!file) {
      return false;
    }
    this.file = file;
    return true;
  }
}
