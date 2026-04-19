/**
 * @file
 *
 * Command handler for folder-specific commands (TFolder only, not TFile).
 */

import type {
  TAbstractFile,
  TFolder,
  WorkspaceLeaf
} from 'obsidian';

import type { AbstractFileCommandHandlerParams } from './abstract-file-command-handler.ts';

import {
  asArrayOfFolders,
  asFolder,
  isFolder
} from '../file-system.ts';
import { AbstractFileCommandHandler } from './abstract-file-command-handler.ts';

/**
 * Command handler for folder-specific commands.
 *
 * Filters abstract files to only accept {@link TFolder} instances.
 * Subclasses override {@link canExecuteFolder} and {@link executeFolder}.
 */
export abstract class FolderCommandHandler extends AbstractFileCommandHandler {
  /**
   * Creates a new folder command handler.
   *
   * @param params - The parameters for the folder command handler.
   */
  public constructor(params: AbstractFileCommandHandlerParams) {
    super(params);
  }

  /**
   * Filters to only accept TFolder instances, then delegates to {@link canExecuteFolder}.
   *
   * @param abstractFile - The file or folder.
   * @returns Whether the command can execute.
   */
  protected override canExecuteAbstractFile(abstractFile: TAbstractFile): boolean {
    return isFolder(abstractFile) && this.canExecuteFolder(abstractFile);
  }

  /**
   * Filters to only accept TFolder arrays, then delegates to {@link canExecuteFolders}.
   *
   * @param abstractFiles - The files or folders.
   * @returns Whether the command can execute.
   */
  protected override canExecuteAbstractFiles(abstractFiles: TAbstractFile[]): boolean {
    return abstractFiles.every((f) => isFolder(f)) && this.canExecuteFolders(asArrayOfFolders(abstractFiles));
  }

  /**
   * Checks whether the command can execute for a single folder.
   *
   * @param _folder - The folder.
   * @returns Whether the command can execute.
   */
  protected canExecuteFolder(_folder: TFolder): boolean {
    return true;
  }

  /**
   * Checks whether the command can execute for multiple folders.
   * Default implementation checks each folder individually.
   *
   * @param folders - The folders.
   * @returns Whether the command can execute.
   */
  protected canExecuteFolders(folders: TFolder[]): boolean {
    return folders.length > 0 && folders.every((f) => this.canExecuteFolder(f));
  }

  /**
   * Delegates to {@link executeFolder}.
   *
   * @param abstractFile - The file or folder.
   */
  protected override async executeAbstractFile(abstractFile: TAbstractFile): Promise<void> {
    await this.executeFolder(asFolder(abstractFile));
  }

  /**
   * Delegates to {@link executeFolders}.
   *
   * @param abstractFiles - The files or folders.
   */
  protected override async executeAbstractFiles(abstractFiles: TAbstractFile[]): Promise<void> {
    await this.executeFolders(asArrayOfFolders(abstractFiles));
  }

  /**
   * Executes the command for a single folder.
   *
   * @param folder - The folder.
   */
  protected abstract executeFolder(folder: TFolder): Promise<void>;

  /**
   * Executes the command for multiple folders.
   * Default implementation executes sequentially.
   *
   * @param folders - The folders.
   */
  protected async executeFolders(folders: TFolder[]): Promise<void> {
    for (const folder of folders) {
      await this.executeFolder(folder);
    }
  }

  /**
   * Filters to only show menu for TFolder instances.
   *
   * @param abstractFile - The file or folder.
   * @param source - The source of the event.
   * @param leaf - The workspace leaf, if available.
   * @returns Whether to add to the file menu.
   */
  protected override shouldAddToAbstractFileMenu(abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf): boolean {
    if (!isFolder(abstractFile)) {
      return false;
    }
    return this.shouldAddToFolderMenu(abstractFile, source, leaf);
  }

  /**
   * Filters to only show menu for TFolder arrays.
   *
   * @param abstractFiles - The files or folders.
   * @param source - The source of the event.
   * @param leaf - The workspace leaf, if available.
   * @returns Whether to add to the files menu.
   */
  protected override shouldAddToAbstractFilesMenu(abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): boolean {
    if (!abstractFiles.every((f) => isFolder(f))) {
      return false;
    }
    return this.shouldAddToFoldersMenu(asArrayOfFolders(abstractFiles), source, leaf);
  }

  /**
   * Checks whether the command should appear in the single-folder context menu.
   *
   * @param _folder - The folder.
   * @param _source - The source of the event.
   * @param _leaf - The workspace leaf, if available.
   * @returns Whether to add to the folder menu.
   */
  protected shouldAddToFolderMenu(_folder: TFolder, _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }

  /**
   * Checks whether the command should appear in the multi-folder context menu.
   *
   * @param _folders - The folders.
   * @param _source - The source of the event.
   * @param _leaf - The workspace leaf, if available.
   * @returns Whether to add to the folders menu.
   */
  protected shouldAddToFoldersMenu(_folders: TFolder[], _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }
}
