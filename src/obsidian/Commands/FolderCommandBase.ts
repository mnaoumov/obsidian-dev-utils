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

import { TFolder } from 'obsidian';

import { CommandInvocationBase } from './CommandBase.ts';
import { NonEditorCommandBase } from './NonEditorCommandBase.ts';

/**
 * Base class for folder commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FolderCommandBase<TPlugin extends Plugin = Plugin> extends NonEditorCommandBase<TPlugin> {
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
  protected abstract override createCommandInvocation(): FolderCommandInvocationBase<TPlugin>;

  /**
   * Checks if the command should be added to the folder menu.
   *
   * @param _folder - The folder to check.
   * @param _source - The source of the folder.
   * @param _leaf - The leaf to check.
   * @returns Whether the command should be added to the folder menu.
   */
  protected shouldAddToFolderMenu(_folder: TFolder, _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }

  private handleFileMenu(menu: Menu, folder: TAbstractFile, source: string, leaf?: WorkspaceLeaf): void {
    if (!(folder instanceof TFolder)) {
      return;
    }

    if (!this.createCommandInvocation().invoke(true)) {
      return;
    }

    if (!this.shouldAddToFolderMenu(folder, source, leaf)) {
      return;
    }

    menu.addItem((item) => {
      item.setTitle(this.menuItemName ?? this.name)
        .setIcon(this.icon)
        .onClick(() => this.createCommandInvocation().invoke(false, folder));

      if (this.menuSection) {
        item.setSection(this.menuSection);
      }
    });
  }
}

/**
 * Base class for folder command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FolderCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  protected folder!: TFolder;

  /**
   * Invokes the command.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @param folder - The folder to invoke the command for.
   * @returns Whether the command was executed.
   */
  public override invoke(checking: boolean, folder?: TFolder): boolean {
    if (folder) {
      this.folder = folder;
    }
    return super.invoke(checking);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    const folder = (this.folder as TFolder | undefined) ?? this.app.workspace.getActiveFile()?.parent;
    if (!folder) {
      return false;
    }
    this.folder = folder;
    return true;
  }
}
