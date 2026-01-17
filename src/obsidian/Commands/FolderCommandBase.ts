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

import type { AbstractFileCommandBaseOptions } from './AbstractFileCommandBase.ts';

import {
  asArrayOfFolders,
  asFolder,
  asFolderOrNull,
  isFolder
} from '../FileSystem.ts';
import {
  AbstractFileCommandBase,
  AbstractFileCommandInvocationBase,
  AbstractFilesCommandInvocationBase
} from './AbstractFileCommandBase.ts';

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
   * @throws If the abstract file is not a folder.
   */
  protected get folder(): TFolder {
    return asFolder(this._abstractFile);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && !!this.folder;
  }
}

/**
 * Base class for array-delegating file command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export class ArrayDelegatingFolderCommandInvocation<TPlugin extends Plugin> extends FolderCommandInvocationBase<TPlugin> {
  /**
   * Creates a new array-delegating folder command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param folder - The file to invoke the command for.
   * @param createCommandInvocationForFiles - The function to create a command invocation for files.
   */
  public constructor(
    plugin: TPlugin,
    folder: null | TFolder,
    private readonly createCommandInvocationForFiles: (folders: TFolder[]) => FoldersCommandInvocationBase<TPlugin>
  ) {
    super(plugin, folder);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && this.createCommandInvocationForFiles([this.folder]).invoke(true);
  }

  /**
   * Executes the command.
   *
   * @returns A promise that resolves when the command has been executed.
   */
  protected override async execute(): Promise<void> {
    await this.createCommandInvocationForFiles([this.folder]).invokeAsync(false);
  }
}

/**
 * Base class for folder commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FolderCommandBase<TPlugin extends Plugin = Plugin> extends AbstractFileCommandBase<TPlugin> {
  /**
   * Creates a new folder command.
   *
   * @param options - The options for the folder command.
   */
  public constructor(options: AbstractFileCommandBaseOptions<TPlugin>) {
    super(options);
  }

  /**
   * Creates a new abstract file command invocation.
   *
   * @param abstractFile - The abstract file to invoke the command for.
   * @returns A new abstract file command invocation.
   */
  protected override createCommandInvocation(abstractFile?: TAbstractFile): AbstractFileCommandInvocationBase<TPlugin> {
    const folder = asFolderOrNull(abstractFile ?? null) ?? this.app.workspace.getActiveFile()?.parent ?? null;
    return this.createCommandInvocationForFolder(folder);
  }

  /**
   * Creates a new abstract file command invocation for an abstract file.
   *
   * @param abstractFile - The abstract file to invoke the command for.
   * @returns A new abstract file command invocation.
   */
  protected override createCommandInvocationForAbstractFile(abstractFile: null | TAbstractFile): AbstractFileCommandInvocationBase<TPlugin> {
    return this.createCommandInvocationForFolder(asFolderOrNull(abstractFile));
  }

  /**
   * Creates a new abstract files command invocation for abstract files.
   *
   * @param abstractFiles - The abstract files to invoke the command for.
   * @returns A new abstract files command invocation.
   */
  protected override createCommandInvocationForAbstractFiles(abstractFiles: TAbstractFile[]): AbstractFilesCommandInvocationBase<TPlugin> {
    return this.createCommandInvocationForFolders(asArrayOfFolders(abstractFiles));
  }

  /**
   * Creates a new abstract file command invocation for a folder.
   *
   * @param folder - The folder to invoke the command for.
   * @returns A new folder command invocation.
   */
  protected abstract createCommandInvocationForFolder(folder: null | TFolder): FolderCommandInvocationBase<TPlugin>;

  /**
   * Creates a new folders command invocation for folders.
   *
   * @param folders - The folders to invoke the command for.
   * @returns A new folders command invocation.
   */
  protected createCommandInvocationForFolders(folders: TFolder[]): FoldersCommandInvocationBase<TPlugin> {
    return new SequentialFoldersCommandInvocationBase(this.plugin, folders, this.createCommandInvocationForFolder.bind(this));
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
    if (!isFolder(abstractFile)) {
      return false;
    }
    return this.shouldAddToFolderMenu(abstractFile, source, leaf);
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
    if (!abstractFiles.every((abstractFile) => isFolder(abstractFile))) {
      return false;
    }
    return this.shouldAddToFoldersMenu(asArrayOfFolders(abstractFiles), source, leaf);
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

  /**
   * Checks if the command should be added to the folders menu.
   *
   * @param _folders - The folders to check.
   * @param _source - The source of the folders.
   * @param _leaf - The leaf to check.
   * @returns Whether the command should be added to the folders menu.
   */
  protected shouldAddToFoldersMenu(_folders: TFolder[], _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }
}

/**
 * Base class for folders command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class FoldersCommandInvocationBase<TPlugin extends Plugin> extends AbstractFilesCommandInvocationBase<TPlugin> {
  /**
   * Creates a new folders command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param folders - The folders to invoke the command for.
   */
  public constructor(plugin: TPlugin, public readonly folders: TFolder[]) {
    super(plugin, folders);
  }
}

/**
 * Base class for sequential folders command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export class SequentialFoldersCommandInvocationBase<TPlugin extends Plugin> extends FoldersCommandInvocationBase<TPlugin> {
  /**
   * Creates a new sequential folders command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param folders - The folders to invoke the command for.
   * @param createCommandInvocationForFolder - The function to create a command invocation for a folder.
   */
  public constructor(
    plugin: TPlugin,
    folders: TFolder[],
    private readonly createCommandInvocationForFolder: (folder: TFolder) => FolderCommandInvocationBase<TPlugin>
  ) {
    super(plugin, folders);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && this.folders.length > 0 && this.folders.every((folder) => this.createCommandInvocationForFolder(folder).invoke(true));
  }

  /**
   * Executes the command.
   *
   * @returns A promise that resolves when the command has been executed.
   */
  protected override async execute(): Promise<void> {
    for (const folder of this.folders) {
      await this.createCommandInvocationForFolder(folder).invokeAsync(false);
    }
  }
}
