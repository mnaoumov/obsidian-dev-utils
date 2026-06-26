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
import type { Promisable } from 'type-fest';

import type {
  AbstractFileCommandHandlerConstructorParams,
  AbstractFileCommandHandlerShouldAddToAbstractFileMenuParams,
  AbstractFileCommandHandlerShouldAddToAbstractFilesMenuParams
} from './abstract-file-command-handler.ts';

import { chain } from '../../async.ts';
import {
  asArrayOfFiles,
  asFile,
  isFile
} from '../file-system.ts';
import { AbstractFileCommandHandler } from './abstract-file-command-handler.ts';

/**
 * Parameters for {@link FileCommandHandler.shouldAddToFileMenu}.
 */
export interface FileCommandHandlerShouldAddToFileMenuParams {
  /**
   * The file.
   */
  readonly file: TFile;

  /**
   * The workspace leaf, if available.
   */
  readonly leaf?: undefined | WorkspaceLeaf;

  /**
   * The source of the event.
   */
  readonly source: string;
}

/**
 * Parameters for {@link FileCommandHandler.shouldAddToFilesMenu}.
 */
export interface FileCommandHandlerShouldAddToFilesMenuParams {
  /**
   * The files.
   */
  readonly files: TFile[];

  /**
   * The workspace leaf, if available.
   */
  readonly leaf?: undefined | WorkspaceLeaf;

  /**
   * The source of the event.
   */
  readonly source: string;
}

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
  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Inherits parent's params type.
  public constructor(params: AbstractFileCommandHandlerConstructorParams) {
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
   * @returns `Promisable<void>` that resolves when abstract file had been executed.
   */
  protected override executeAbstractFile(abstractFile: TAbstractFile): Promisable<void> {
    return this.executeFile(asFile(abstractFile));
  }

  /**
   * Delegates to {@link executeFiles}.
   *
   * @param abstractFiles - The files or folders.
   * @returns `Promisable<void>` that resolves when all abstract files have been executed.
   */
  protected override executeAbstractFiles(abstractFiles: TAbstractFile[]): Promisable<void> {
    return this.executeFiles(asArrayOfFiles(abstractFiles));
  }

  /**
   * Executes the command for a single file.
   *
   * @param file - The file.
   */
  protected abstract executeFile(file: TFile): Promisable<void>;

  /**
   * Executes the command for multiple files.
   * Default implementation executes sequentially.
   *
   * @param files - The files.
   * @returns `Promisable<void>` that resolves when all files have been executed.
   */
  protected executeFiles(files: TFile[]): Promisable<void> {
    let promise: null | Promise<void> = null;
    for (const file of files) {
      promise = chain(promise, () => this.executeFile(file));
    }

    if (promise) {
      return promise;
    }
  }

  /**
   * Filters to only show menu for TFile instances.
   *
   * @param params - The parameters for the single-file menu check.
   * @returns Whether to add to the file menu.
   */
  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Override keeps the base class param type.
  protected override shouldAddToAbstractFileMenu(params: AbstractFileCommandHandlerShouldAddToAbstractFileMenuParams): boolean {
    const {
      abstractFile,
      leaf,
      source
    } = params;
    if (!isFile(abstractFile)) {
      return false;
    }
    return this.shouldAddToFileMenu({
      file: abstractFile,
      leaf,
      source
    });
  }

  /**
   * Filters to only show menu for TFile arrays.
   *
   * @param params - The parameters for the multi-file menu check.
   * @returns Whether to add to the files menu.
   */
  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Override keeps the base class param type.
  protected override shouldAddToAbstractFilesMenu(params: AbstractFileCommandHandlerShouldAddToAbstractFilesMenuParams): boolean {
    const {
      abstractFiles,
      leaf,
      source
    } = params;
    if (!abstractFiles.every((f) => isFile(f))) {
      return false;
    }
    return this.shouldAddToFilesMenu({
      files: asArrayOfFiles(abstractFiles),
      leaf,
      source
    });
  }

  /**
   * Checks whether the command should appear in the single-file context menu.
   *
   * @param params - The parameters for the single-file menu check.
   * @returns Whether to add to the file menu.
   */
  protected shouldAddToFileMenu(params: FileCommandHandlerShouldAddToFileMenuParams): boolean {
    const { file: _file, leaf: _leaf, source: _source } = params;
    return false;
  }

  /**
   * Checks whether the command should appear in the multi-file context menu.
   *
   * @param params - The parameters for the multi-file menu check.
   * @returns Whether to add to the files menu.
   */
  protected shouldAddToFilesMenu(params: FileCommandHandlerShouldAddToFilesMenuParams): boolean {
    const { files: _files, leaf: _leaf, source: _source } = params;
    return false;
  }
}
