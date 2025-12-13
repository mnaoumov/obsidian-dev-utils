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
  asArrayOfFiles,
  asFile,
  asFileOrNull,
  isFile
} from '../FileSystem.ts';
import {
  AbstractFileCommandBase,
  AbstractFileCommandInvocationBase,
  AbstractFilesCommandInvocationBase
} from './AbstractFileCommandBase.ts';

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
   * @throws If the abstract file is not a file.
   */
  protected get file(): TFile {
    return asFile(this._abstractFile);
  }

  /**
   * Creates a new file command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param file - The file to invoke the command for.
   */
  public constructor(plugin: TPlugin, file: null | TFile) {
    super(plugin, file);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && !!this._abstractFile;
  }
}

/**
 * Base class for array-delegating file command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export class ArrayDelegatingFileCommandInvocation<TPlugin extends Plugin> extends FileCommandInvocationBase<TPlugin> {
  /**
   * Creates a new array-delegating file command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param file - The file to invoke the command for.
   * @param createCommandInvocationForFiles - The function to create a command invocation for files.
   */
  public constructor(
    plugin: TPlugin,
    file: null | TFile,
    private readonly createCommandInvocationForFiles: (files: TFile[]) => FilesCommandInvocationBase<TPlugin>
  ) {
    super(plugin, file);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && this.createCommandInvocationForFiles([this.file]).invoke(true);
  }

  /**
   * Executes the command.
   *
   * @returns A promise that resolves when the command has been executed.
   */
  protected override async execute(): Promise<void> {
    await this.createCommandInvocationForFiles([this.file]).invokeAsync(false);
  }
}

/**
 * Base class for file commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FileCommandBase<TPlugin extends Plugin = Plugin> extends AbstractFileCommandBase<TPlugin> {
  /**
   * Creates a new abstract file command invocation.
   *
   * @param abstractFile - The abstract file to invoke the command for.
   * @returns The command invocation.
   */
  protected override createCommandInvocation(abstractFile?: TAbstractFile): AbstractFileCommandInvocationBase<TPlugin> {
    return this.createCommandInvocationForAbstractFile(abstractFile ?? this.app.workspace.getActiveFile());
  }

  /**
   * Creates a new abstract file command invocation for an abstract file.
   *
   * @param abstractFile - The abstract file to invoke the command for. If `null`, the active file is used.
   * @returns The command invocation.
   */
  protected override createCommandInvocationForAbstractFile(abstractFile: null | TAbstractFile): AbstractFileCommandInvocationBase<TPlugin> {
    return this.createCommandInvocationForFile(asFileOrNull(abstractFile));
  }

  /**
   * Creates a new abstract files command invocation for abstract files.
   *
   * @param abstractFiles - The abstract files to invoke the command for.
   * @returns A new abstract files command invocation.
   */
  protected override createCommandInvocationForAbstractFiles(abstractFiles: TAbstractFile[]): AbstractFilesCommandInvocationBase<TPlugin> {
    return this.createCommandInvocationForFiles(asArrayOfFiles(abstractFiles));
  }

  /**
   * Creates a new file command invocation for a file.
   *
   * @param file - The file to invoke the command for.
   * @returns A new file command invocation.
   */
  protected abstract createCommandInvocationForFile(file: null | TFile): FileCommandInvocationBase<TPlugin>;

  /**
   * Creates a new files command invocation for files.
   *
   * @param files - The files to invoke the command for.
   * @returns A new files command invocation.
   */
  protected createCommandInvocationForFiles(files: TFile[]): FilesCommandInvocationBase<TPlugin> {
    return new SequentialFilesCommandInvocationBase(this.plugin, files, this.createCommandInvocationForFile.bind(this));
  }

  /**
   * Checks if the command should be added to the abstract file menu.
   *
   * @param abstractFile - The abstract file to check.
   * @param source - The source of the abstract file.
   * @param leaf - The leaf to check.
   * @returns Whether the command should be added to the abstract file menu.
   */
  protected override shouldAddToAbstractFileMenu(abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf): boolean {
    if (!isFile(abstractFile)) {
      return false;
    }
    return this.shouldAddToFileMenu(abstractFile, source, leaf);
  }

  /**
   * Checks if the command should be added to the abstract files menu.
   *
   * @param abstractFiles - The abstract files to check.
   * @param source - The source of the abstract files.
   * @param leaf - The leaf to check.
   * @returns Whether the command should be added to the abstract files menu.
   */
  protected override shouldAddToAbstractFilesMenu(abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): boolean {
    if (!abstractFiles.every((abstractFile) => isFile(abstractFile))) {
      return false;
    }
    return this.shouldAddToFilesMenu(asArrayOfFiles(abstractFiles), source, leaf);
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

  /**
   * Checks if the command should be added to the files menu.
   *
   * @param _files - The files to check.
   * @param _source - The source of the files.
   * @param _leaf - The leaf to check.
   * @returns Whether the command should be added to the files menu.
   */
  protected shouldAddToFilesMenu(_files: TFile[], _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }
}

/**
 * Base class for files command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FilesCommandInvocationBase<TPlugin extends Plugin> extends AbstractFilesCommandInvocationBase<TPlugin> {
  /**
   * Creates a new files command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param files - The files to invoke the command for.
   */
  public constructor(plugin: TPlugin, public readonly files: TFile[]) {
    super(plugin, files);
  }
}

/**
 * Base class for sequential files command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export class SequentialFilesCommandInvocationBase<TPlugin extends Plugin> extends FilesCommandInvocationBase<TPlugin> {
  /**
   * Creates a new sequential files command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param files - The files to invoke the command for.
   * @param createCommandInvocationForFile - The function to create a command invocation for a file.
   */
  public constructor(plugin: TPlugin, files: TFile[], private readonly createCommandInvocationForFile: (file: TFile) => FileCommandInvocationBase<TPlugin>) {
    super(plugin, files);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && this.files.length > 0 && this.files.every((file) => this.createCommandInvocationForFile(file).invoke(true));
  }

  /**
   * Executes the command.
   *
   * @returns A promise that resolves when the command has been executed.
   */
  protected override async execute(): Promise<void> {
    for (const file of this.files) {
      await this.createCommandInvocationForFile(file).invokeAsync(false);
    }
  }
}
