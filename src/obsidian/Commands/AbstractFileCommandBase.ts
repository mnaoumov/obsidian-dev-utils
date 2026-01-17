/**
 * @packageDocumentation
 *
 * Base classes for abstract file commands.
 */

import type {
  IconName,
  Menu,
  Plugin,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';

import type { CommandBaseOptions } from './CommandBase.ts';

import { CommandInvocationBase } from './CommandBase.ts';
import { NonEditorCommandBase } from './NonEditorCommandBase.ts';

/**
 * Options for creating an abstract file command.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export interface AbstractFileCommandBaseOptions<TPlugin extends Plugin> extends CommandBaseOptions<TPlugin> {
  /**
   * The item name to use in the file menu.
   */
  fileMenuItemName?: string | undefined;

  /**
   * The section to use in the file menu.
   */
  fileMenuSection?: string | undefined;

  /**
   * The icon to use in the file menu submenu.
   */
  fileMenuSubmenuIcon?: IconName | undefined;

  /**
   * The item name to use in the files menu.
   */
  filesMenuItemName?: string | undefined;

  /**
   * The section to use in the files menu.
   */
  filesMenuSection?: string | undefined;

  /**
   * The icon to use in the files menu submenu.
   */
  filesMenuSubmenuIcon?: IconName | undefined;

  /**
   * Whether to add the command to the submenu.
   */
  shouldAddCommandToSubmenu?: boolean | undefined;
}

/**
 * Base class for abstract file commands.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class AbstractFileCommandBase<TPlugin extends Plugin = Plugin> extends NonEditorCommandBase<TPlugin> {
  /**
   * Gets the item name to use in the file menu.
   *
   * @returns The item name to use in the file menu.
   */
  protected get fileMenuItemName(): string | undefined {
    return this._fileMenuItemName;
  }

  /**
   * Gets the section to use in the file menu.
   *
   * @returns The section to use in the file menu.
   */
  protected get fileMenuSection(): string | undefined {
    return this._fileMenuSection;
  }

  /**
   * Gets the icon to use in the file menu submenu.
   *
   * @returns The icon to use in the file menu submenu.
   */
  protected get fileMenuSubmenuIcon(): IconName | undefined {
    return this._fileMenuSubmenuIcon;
  }

  /**
   * Gets the item name to use in the files menu.
   *
   * @returns The item name to use in the files menu.
   */
  protected get filesMenuItemName(): string | undefined {
    return this._filesMenuItemName;
  }

  /**
   * Gets the section to use in the files menu.
   *
   * @returns The section to use in the files menu.
   */
  protected get filesMenuSection(): string | undefined {
    return this._filesMenuSection;
  }

  /**
   * Gets the icon to use in the files menu submenu.
   *
   * @returns The icon to use in the files menu submenu.
   */
  protected get filesMenuSubmenuIcon(): IconName | undefined {
    return this._filesMenuSubmenuIcon;
  }

  /**
   * Gets whether to add the command to the submenu.
   *
   * @returns Whether to add the command to the submenu.
   */
  protected get shouldAddCommandToSubmenu(): boolean | undefined {
    return this._shouldAddCommandToSubmenu;
  }

  private readonly _fileMenuItemName?: string | undefined;
  private readonly _fileMenuSection?: string | undefined;
  private readonly _fileMenuSubmenuIcon?: IconName | undefined;
  private readonly _filesMenuItemName?: string | undefined;
  private readonly _filesMenuSection?: string | undefined;
  private readonly _filesMenuSubmenuIcon?: IconName | undefined;
  private readonly _shouldAddCommandToSubmenu?: boolean | undefined;

  /**
   * Creates a new abstract file command.
   *
   * @param options - The options for the abstract file command.
   */
  public constructor(options: AbstractFileCommandBaseOptions<TPlugin>) {
    super(options);
    this._fileMenuItemName = options.fileMenuItemName;
    this._fileMenuSection = options.fileMenuSection;
    this._fileMenuSubmenuIcon = options.fileMenuSubmenuIcon;
    this._filesMenuItemName = options.filesMenuItemName;
    this._filesMenuSection = options.filesMenuSection;
    this._filesMenuSubmenuIcon = options.filesMenuSubmenuIcon;
    this._shouldAddCommandToSubmenu = options.shouldAddCommandToSubmenu;
  }

  /**
   * Checks if the command can execute or executes it.
   *
   * @param checking - Is checking mode only. If `true`, only the check if the command can execute is performed. If `false`, the command is executed.
   * @returns Whether the command can execute.
   */
  public override checkCallback(checking: boolean): boolean {
    if (!this.shouldAddToCommandPalette()) {
      return false;
    }
    return super.checkCallback(checking);
  }

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
   * @param abstractFile - The abstract file to create the command invocation for.
   * @returns The command invocation.
   */
  protected override createCommandInvocation(abstractFile?: TAbstractFile): AbstractFileCommandInvocationBase<TPlugin> {
    return this.createCommandInvocationForAbstractFile(abstractFile ?? this.app.workspace.getActiveFile());
  }

  /**
   * Creates a new command invocation for an abstract file.
   *
   * @param abstractFile - The abstract file to create the command invocation for.
   * @returns The command invocation.
   */
  protected abstract createCommandInvocationForAbstractFile(abstractFile: null | TAbstractFile): AbstractFileCommandInvocationBase<TPlugin>;

  /**
   * Creates a new command invocation for abstract files.
   *
   * @param abstractFiles - The abstract files to create the command invocation for.
   * @returns The command invocation.
   */
  protected createCommandInvocationForAbstractFiles(abstractFiles: TAbstractFile[]): AbstractFilesCommandInvocationBase<TPlugin> {
    return new SequentialAbstractFilesCommandInvocationBase(this.plugin, abstractFiles, this.createCommandInvocationForAbstractFile.bind(this));
  }

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

  /**
   * Checks if the command should be added to the abstract files menu.
   *
   * @param abstractFiles - The abstract files to check.
   * @param source - The source of the abstract files.
   * @param leaf - The leaf to check.
   * @returns Whether the command should be added to the abstract files menu.
   */
  protected shouldAddToAbstractFilesMenu(abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): boolean {
    for (const abstractFile of abstractFiles) {
      if (!this.shouldAddToAbstractFileMenu(abstractFile, source, leaf)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if the command should be added to the command palette.
   *
   * @returns Whether the command should be added to the command palette.
   */
  protected shouldAddToCommandPalette(): boolean {
    return true;
  }

  private handleAbstractFileMenu(menu: Menu, abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf): void {
    if (!this.shouldAddToAbstractFileMenu(abstractFile, source, leaf)) {
      return;
    }

    if (!this.createCommandInvocation(abstractFile).invoke(true)) {
      return;
    }

    let fileMenuSection = this.fileMenuSection;
    if (this.shouldAddCommandToSubmenu) {
      fileMenuSection ??= this.plugin.manifest.name;
      menu.setSectionSubmenu(fileMenuSection, {
        icon: this.fileMenuSubmenuIcon ?? '',
        title: fileMenuSection
      });
    } else {
      fileMenuSection ??= '';
    }
    menu.addItem((item) => {
      item
        .setTitle(this.fileMenuItemName ?? this.originalName)
        .setIcon(this.icon)
        .setSection(fileMenuSection)
        .onClick(() => this.createCommandInvocation(abstractFile).invoke(false));
    });
  }

  private handleAbstractFilesMenu(menu: Menu, abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): void {
    if (!this.shouldAddToAbstractFilesMenu(abstractFiles, source, leaf)) {
      return;
    }

    if (!this.createCommandInvocationForAbstractFiles(abstractFiles).invoke(true)) {
      return;
    }

    let filesMenuSection = this.filesMenuSection ?? this.fileMenuSection;
    if (this.shouldAddCommandToSubmenu) {
      filesMenuSection ??= this.plugin.manifest.name;
      menu.setSectionSubmenu(filesMenuSection, {
        icon: this.filesMenuSubmenuIcon ?? this.fileMenuSubmenuIcon ?? '',
        title: filesMenuSection
      });
    } else {
      filesMenuSection ??= '';
    }

    menu.addItem((item) => {
      item
        .setTitle(this.filesMenuItemName ?? this.fileMenuItemName ?? this.originalName)
        .setIcon(this.icon)
        .setSection(filesMenuSection)
        .onClick(() => this.createCommandInvocationForAbstractFiles(abstractFiles).invoke(false));
    });
  }
}

/**
 * Base class for abstract file command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class AbstractFileCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  /** */
  protected readonly _abstractFile: null | TAbstractFile;

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
   * Creates a new abstract file command invocation.
   *
   * @param plugin - The plugin that the command belongs to.
   * @param abstractFile - The abstract file to invoke the command for.
   */
  public constructor(plugin: TPlugin, abstractFile: null | TAbstractFile) {
    super(plugin);
    this._abstractFile = abstractFile;
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
 * Base class for abstract files command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export abstract class AbstractFilesCommandInvocationBase<TPlugin extends Plugin> extends CommandInvocationBase<TPlugin> {
  /**
   * Creates a new abstract files command invocation.
   *
   * @param plugin - The plugin that the command belongs to.
   * @param abstractFiles - The abstract files to invoke the command for.
   */
  public constructor(plugin: TPlugin, public readonly abstractFiles: TAbstractFile[]) {
    super(plugin);
  }
}

/**
 * Base class for array-delegating abstract file command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export class ArrayDelegatingAbstractFileCommandInvocation<TPlugin extends Plugin> extends AbstractFileCommandInvocationBase<TPlugin> {
  /**
   * Creates a new array-delegating abstract file command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param abstractFile - The abstract file to invoke the command for.
   * @param createCommandInvocationForFiles - The function to create a command invocation for files.
   */
  public constructor(
    plugin: TPlugin,
    abstractFile: null | TAbstractFile,
    private readonly createCommandInvocationForFiles: (abstractFiles: TAbstractFile[]) => AbstractFilesCommandInvocationBase<TPlugin>
  ) {
    super(plugin, abstractFile);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && this.createCommandInvocationForFiles([this.abstractFile]).invoke(true);
  }

  /**
   * Executes the command.
   *
   * @returns A promise that resolves when the command has been executed.
   */
  protected override async execute(): Promise<void> {
    await this.createCommandInvocationForFiles([this.abstractFile]).invokeAsync(false);
  }
}

/**
 * Base class for sequential abstract files command invocations.
 *
 * @typeParam TPlugin - The type of the plugin that the command belongs to.
 */
export class SequentialAbstractFilesCommandInvocationBase<TPlugin extends Plugin> extends AbstractFilesCommandInvocationBase<TPlugin> {
  /**
   * Creates a new sequential files command invocation.
   *
   * @param plugin - The plugin that the command invocation belongs to.
   * @param abstractFiles - The files to invoke the command for.
   * @param createCommandInvocationForFile - The function to create a command invocation for a file.
   */
  public constructor(
    plugin: TPlugin,
    abstractFiles: TAbstractFile[],
    private readonly createCommandInvocationForFile: (abstractFile: TAbstractFile) => AbstractFileCommandInvocationBase<TPlugin>
  ) {
    super(plugin, abstractFiles);
  }

  /**
   * Checks if the command can execute.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    return super.canExecute() && this.abstractFiles.length > 0 && this.abstractFiles.every((file) => this.createCommandInvocationForFile(file).invoke(true));
  }

  /**
   * Executes the command.
   *
   * @returns A promise that resolves when the command has been executed.
   */
  protected override async execute(): Promise<void> {
    for (const abstractFile of this.abstractFiles) {
      await this.createCommandInvocationForFile(abstractFile).invokeAsync(false);
    }
  }
}
