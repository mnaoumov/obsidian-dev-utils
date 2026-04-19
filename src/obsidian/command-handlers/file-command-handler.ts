/**
 * @file
 *
 * Command handler for file-specific commands (TFile only, not TFolder).
 */

import type {
  TAbstractFile,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import type { AbstractFileCommandHandlerParams } from './abstract-file-command-handler.ts';

import {
  asArrayOfFiles,
  asFile,
  isFile
} from '../file-system.ts';
import { AbstractFileCommandHandler } from './abstract-file-command-handler.ts';

/**
 * Command handler for file-specific commands.
 *
 * Filters abstract files to only accept {@link TFile} instances.
 * Subclasses override {@link canExecuteFile} and {@link executeFile}.
 */
export abstract class FileCommandHandler extends AbstractFileCommandHandler {
  /**
   * Creates a new file command handler.
   *
   * @param params - The parameters for the file command handler.
   */
  public constructor(params: AbstractFileCommandHandlerParams) {
    super(params);
  }

  /**
   * Filters to only accept TFile instances, then delegates to {@link canExecuteFile}.
   *
   * @param abstractFile - The file or folder.
   * @returns Whether the command can execute.
   */
  protected override canExecuteAbstractFile(abstractFile: TAbstractFile): boolean {
    return isFile(abstractFile) && this.canExecuteFile(abstractFile);
  }

  /**
   * Filters to only accept TFile arrays, then delegates to {@link canExecuteFiles}.
   *
   * @param abstractFiles - The files or folders.
   * @returns Whether the command can execute.
   */
  protected override canExecuteAbstractFiles(abstractFiles: TAbstractFile[]): boolean {
    return abstractFiles.every((f) => isFile(f)) && this.canExecuteFiles(asArrayOfFiles(abstractFiles));
  }

  /**
   * Checks whether the command can execute for a single file.
   *
   * @param _file - The file.
   * @returns Whether the command can execute.
   */
  protected canExecuteFile(_file: TFile): boolean {
    return true;
  }

  /**
   * Checks whether the command can execute for multiple files.
   * Default implementation checks each file individually.
   *
   * @param files - The files.
   * @returns Whether the command can execute.
   */
  protected canExecuteFiles(files: TFile[]): boolean {
    return files.length > 0 && files.every((f) => this.canExecuteFile(f));
  }

  /**
   * Delegates to {@link executeFile}.
   *
   * @param abstractFile - The file or folder.
   */
  protected override async executeAbstractFile(abstractFile: TAbstractFile): Promise<void> {
    await this.executeFile(asFile(abstractFile));
  }

  /**
   * Delegates to {@link executeFiles}.
   *
   * @param abstractFiles - The files or folders.
   */
  protected override async executeAbstractFiles(abstractFiles: TAbstractFile[]): Promise<void> {
    await this.executeFiles(asArrayOfFiles(abstractFiles));
  }

  /**
   * Executes the command for a single file.
   *
   * @param file - The file.
   */
  protected abstract executeFile(file: TFile): Promise<void>;

  /**
   * Executes the command for multiple files.
   * Default implementation executes sequentially.
   *
   * @param files - The files.
   */
  protected async executeFiles(files: TFile[]): Promise<void> {
    for (const file of files) {
      await this.executeFile(file);
    }
  }

  /**
   * Filters to only show menu for TFile instances.
   *
   * @param abstractFile - The file or folder.
   * @param source - The source of the event.
   * @param leaf - The workspace leaf, if available.
   * @returns Whether to add to the file menu.
   */
  protected override shouldAddToAbstractFileMenu(abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf): boolean {
    if (!isFile(abstractFile)) {
      return false;
    }
    return this.shouldAddToFileMenu(abstractFile, source, leaf);
  }

  /**
   * Filters to only show menu for TFile arrays.
   *
   * @param abstractFiles - The files or folders.
   * @param source - The source of the event.
   * @param leaf - The workspace leaf, if available.
   * @returns Whether to add to the files menu.
   */
  protected override shouldAddToAbstractFilesMenu(abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): boolean {
    if (!abstractFiles.every((f) => isFile(f))) {
      return false;
    }
    return this.shouldAddToFilesMenu(asArrayOfFiles(abstractFiles), source, leaf);
  }

  /**
   * Checks whether the command should appear in the single-file context menu.
   *
   * @param _file - The file.
   * @param _source - The source of the event.
   * @param _leaf - The workspace leaf, if available.
   * @returns Whether to add to the file menu.
   */
  protected shouldAddToFileMenu(_file: TFile, _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }

  /**
   * Checks whether the command should appear in the multi-file context menu.
   *
   * @param _files - The files.
   * @param _source - The source of the event.
   * @param _leaf - The workspace leaf, if available.
   * @returns Whether to add to the files menu.
   */
  protected shouldAddToFilesMenu(_files: TFile[], _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }
}
