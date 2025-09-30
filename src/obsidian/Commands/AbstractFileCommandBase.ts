/**
 * @packageDocumentation
 *
 * Base classes for abstract file commands.
 */

import type {
  Menu,
  Plugin,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { CommandInvocationBase } from './CommandBase.ts';
import { NonEditorCommandBase } from './NonEditorCommandBase.ts';

/**
 * Base class for abstract file commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class AbstractFileCommandBase<TPlugin extends Plugin = Plugin> extends NonEditorCommandBase<TPlugin> {
  /**
   * The item name to use in the file menu.
   */
  protected readonly fileMenuItemName?: string;

  /**
   * The section to use in the file menu.
   */
  protected readonly fileMenuSection?: string;

  /**
   * The item name to use in the files menu.
   */
  protected readonly filesMenuItemName?: string;

  /**
   * The section to use in the files menu.
   */
  protected readonly filesMenuSection?: string;

  /**
   * Registers the command.
   */
  public override register(): void {
    super.register();
    this.plugin.registerEvent(this.app.workspace.on('file-menu', this.handleAbstractFileMenu.bind(this)));
    this.plugin.registerEvent(this.app.workspace.on('files-menu', this.handleAbstractFilesMenu.bind(this)));
  }

  /**
   * Creates a new file command invocation.
   *
   * @returns The command invocation.
   */
  protected abstract override createCommandInvocation(): AbstractFileCommandInvocationBase<TPlugin>;

  /**
   * Checks if the command should be added to the abstract file menu.
   *
   * @param _abstractFile - The abstract file to check.
   * @param _source - The source of the abstract file.
   * @param _leaf - The leaf to check.
   * @returns Whether the command should be added to the abstract file menu.
   */
  protected shouldAddToAbstractFileMenu(_abstractFile: TAbstractFile, _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }

  private handleAbstractFileMenu(menu: Menu, abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf): void {
    if (!this.shouldAddToAbstractFileMenu(abstractFile, source, leaf)) {
      return;
    }

    if (!this.createCommandInvocation().invoke(true, abstractFile)) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle(this.fileMenuItemName ?? this.originalName)
        .setIcon(this.icon)
        .setSection(this.fileMenuSection ?? '')
        .onClick(() => this.createCommandInvocation().invoke(false, abstractFile));
    });
  }

  private handleAbstractFilesMenu(menu: Menu, abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): void {
    for (const abstractFile of abstractFiles) {
      if (!this.shouldAddToAbstractFileMenu(abstractFile, source, leaf)) {
        return;
      }

      if (!this.createCommandInvocation().invoke(true, abstractFile)) {
        return;
      }
    }

    menu.addItem((item) => {
      item
        .setTitle(this.filesMenuItemName ?? this.fileMenuItemName ?? this.originalName)
        .setIcon(this.icon)
        .setSection(this.filesMenuSection ?? this.fileMenuSection ?? '')
        .onClick(() => {
          for (const abstractFile of abstractFiles) {
            this.createCommandInvocation().invoke(false, abstractFile);
          }
        });
    });
  }
}

/**
 * Base class for abstract file command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class AbstractFileCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  /**
   * The abstract file to invoke the command for.
   *
   * @returns The abstract file to invoke the command for.
   * @throws If the abstract file is not set.
   */
  protected get abstractFile(): TAbstractFile {
    if (!this._abstractFile) {
      throw new Error('Abstract file not set');
    }
    return this._abstractFile;
  }

  /**
   * Sets the abstract file to invoke the command for.
   *
   * @param abstractFile - The abstract file to invoke the command for.
   */
  protected set abstractFile(abstractFile: TAbstractFile) {
    this._abstractFile = abstractFile;
  }

  private _abstractFile?: TAbstractFile;

  /**
   * Invokes the command.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @param abstractFile - The abstract file to invoke the command for.
   * @returns Whether the command was executed.
   */
  public override invoke(checking: boolean, abstractFile?: TAbstractFile): boolean {
    if (abstractFile) {
      this._abstractFile = abstractFile;
    }
    return super.invoke(checking);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    if (!super.canExecute()) {
      return false;
    }
    const abstractFile = this._abstractFile ?? this.app.workspace.getActiveFile();
    if (!abstractFile) {
      return false;
    }
    this._abstractFile = abstractFile;
    return true;
  }
}
