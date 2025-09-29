/**
 * @packageDocumentation
 *
 * Base classes for folder commands.
 */

import type {
  Plugin,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { TFolder } from 'obsidian';

import {
  AbstractFileCommandBase,
  AbstractFileCommandInvocationBase
} from './AbstractFileCommandBase.ts';

/**
 * Base class for folder commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FolderCommandBase<TPlugin extends Plugin = Plugin> extends AbstractFileCommandBase<TPlugin> {
  /**
   * Creates a new file command invocation.
   *
   * @returns The command invocation.
   */
  protected abstract override createCommandInvocation(): FolderCommandInvocationBase<TPlugin>;

  /**
   * Checks if the command should be added to the abstract file menu.
   *
   * @param abstractFile - The abstract file to check.
   * @param _source - The source of the abstract file.
   * @param _leaf - The leaf to check.
   * @returns Whether the command should be added to the abstract file menu.
   */
  protected override shouldAddToAbstractFileMenu(abstractFile: TAbstractFile, _source: string, _leaf?: WorkspaceLeaf): boolean {
    if (!(abstractFile instanceof TFolder)) {
      return false;
    }
    return this.shouldAddToFolderMenu(abstractFile, _source, _leaf);
  }

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
}

/**
 * Base class for folder command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FolderCommandInvocationBase<TPlugin extends Plugin> extends AbstractFileCommandInvocationBase<TPlugin> {
  /**
   * Gets the folder that the command invocation belongs to.
   *
   * @returns The folder that the command invocation belongs to.
   */
  protected get folder(): TFolder {
    return this.abstractFile as TFolder;
  }

  /**
   * Sets the folder that the command invocation belongs to.
   *
   * @param folder - The folder that the command invocation belongs to.
   */
  protected set folder(folder: TFolder) {
    this.abstractFile = folder;
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

    if (!(this.abstractFile instanceof TFolder)) {
      const folder = this.app.workspace.getActiveFile()?.parent;
      if (!folder) {
        return false;
      }
      this.folder = folder;
    }

    return true;
  }
}
