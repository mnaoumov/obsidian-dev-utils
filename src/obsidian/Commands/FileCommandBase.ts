/**
 * @packageDocumentation
 *
 * Base classes for file commands.
 */

import type {
  Plugin,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import { TFile } from 'obsidian';

import {
  AbstractFileCommandBase,
  AbstractFileCommandInvocationBase
} from './AbstractFileCommandBase.ts';

/**
 * Base class for file commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FileCommandBase<TPlugin extends Plugin = Plugin> extends AbstractFileCommandBase<TPlugin> {
  /**
   * Creates a new file command invocation.
   *
   * @returns The command invocation.
   */
  protected abstract override createCommandInvocation(): FileCommandInvocationBase<TPlugin>;

  /**
   * Checks if the command should be added to the abstract file menu.
   *
   * @param abstractFile - The abstract file to check.
   * @param _source - The source of the abstract file.
   * @param _leaf - The leaf to check.
   * @returns Whether the command should be added to the abstract file menu.
   */
  protected override shouldAddToAbstractFileMenu(abstractFile: TAbstractFile, _source: string, _leaf?: WorkspaceLeaf): boolean {
    if (!(abstractFile instanceof TFile)) {
      return false;
    }
    return this.shouldAddToFileMenu(abstractFile, _source, _leaf);
  }

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
}

/**
 * Base class for file command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FileCommandInvocationBase<TPlugin extends Plugin> extends AbstractFileCommandInvocationBase<TPlugin> {
  /**
   * Gets the file that the command invocation belongs to.
   *
   * @returns The file that the command invocation belongs to.
   */
  protected get file(): TFile {
    return this.abstractFile as TFile;
  }

  /**
   * Sets the file that the command invocation belongs to.
   *
   * @param file - The file that the command invocation belongs to.
   */
  protected set file(file: TFile) {
    this.abstractFile = file;
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

    if (!(this.abstractFile instanceof TFile)) {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        return false;
      }
      this.file = file;
    }

    return true;
  }
}
