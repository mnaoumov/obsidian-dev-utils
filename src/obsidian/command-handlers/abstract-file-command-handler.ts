/**
 * @file
 *
 * Command handler for abstract file commands with file/files menu integration.
 */

import type {
  IconName,
  Menu,
  TAbstractFile,
  WorkspaceLeaf
} from 'obsidian';
import type { Promisable } from 'type-fest';

import type { ActiveFileProvider } from '../active-file-provider.ts';
import type {
  CommandHandlerParams,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { invokeAsyncSafely } from '../../async.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { GlobalCommandHandler } from './global-command-handler.ts';

/**
 * Parameters for creating an abstract file command handler.
 */
export interface AbstractFileCommandHandlerParams extends CommandHandlerParams {
  /**
   * The item name to use in the single-file menu.
   */
  readonly fileMenuItemName?: string | undefined;

  /**
   * The section to use in the single-file menu.
   */
  readonly fileMenuSection?: string | undefined;

  /**
   * The icon to use in the single-file menu submenu.
   */
  readonly fileMenuSubmenuIcon?: IconName | undefined;

  /**
   * The item name to use in the multi-file menu.
   */
  readonly filesMenuItemName?: string | undefined;

  /**
   * The section to use in the multi-file menu.
   */
  readonly filesMenuSection?: string | undefined;

  /**
   * The icon to use in the multi-file menu submenu.
   */
  readonly filesMenuSubmenuIcon?: IconName | undefined;

  /**
   * Whether to add the command to a submenu.
   */
  readonly shouldAddCommandToSubmenu?: boolean | undefined;
}

/**
 * Command handler for abstract file commands.
 *
 * Handles both single-file and multi-file context menus.
 * Subclasses override {@link canExecuteAbstractFile} and {@link executeAbstractFile}.
 */
export abstract class AbstractFileCommandHandler extends GlobalCommandHandler {
  /**
   * Gets the item name to use in the single-file menu.
   *
   * @returns The item name, or `undefined` to use the command name.
   */
  protected get fileMenuItemName(): string | undefined {
    return this._fileMenuItemName;
  }

  /**
   * Gets the section to use in the single-file menu.
   *
   * @returns The section name, or `undefined` to use the plugin name.
   */
  protected get fileMenuSection(): string | undefined {
    return this._fileMenuSection;
  }

  /**
   * Gets the icon to use in the single-file menu submenu.
   *
   * @returns The icon, or `undefined` for no icon.
   */
  protected get fileMenuSubmenuIcon(): IconName | undefined {
    return this._fileMenuSubmenuIcon;
  }

  /**
   * Gets the item name to use in the multi-file menu.
   *
   * @returns The item name, or `undefined` to fall back to single-file item name.
   */
  protected get filesMenuItemName(): string | undefined {
    return this._filesMenuItemName;
  }

  /**
   * Gets the section to use in the multi-file menu.
   *
   * @returns The section name, or `undefined` to fall back to single-file section.
   */
  protected get filesMenuSection(): string | undefined {
    return this._filesMenuSection;
  }

  /**
   * Gets the icon to use in the multi-file menu submenu.
   *
   * @returns The icon, or `undefined` to fall back to single-file submenu icon.
   */
  protected get filesMenuSubmenuIcon(): IconName | undefined {
    return this._filesMenuSubmenuIcon;
  }

  /**
   * Gets whether to add the command to a submenu.
   *
   * @returns Whether to add to a submenu.
   */
  protected get shouldAddCommandToSubmenu(): boolean | undefined {
    return this._shouldAddCommandToSubmenu;
  }

  private _activeFileProvider?: ActiveFileProvider;
  private readonly _fileMenuItemName?: string | undefined;
  private readonly _fileMenuSection?: string | undefined;
  private readonly _fileMenuSubmenuIcon?: IconName | undefined;
  private readonly _filesMenuItemName?: string | undefined;
  private readonly _filesMenuSection?: string | undefined;
  private readonly _filesMenuSubmenuIcon?: IconName | undefined;
  private _pluginName?: string;
  private readonly _shouldAddCommandToSubmenu?: boolean | undefined;

  private get activeFileProvider(): ActiveFileProvider {
    return ensureNonNullable(this._activeFileProvider);
  }

  private get pluginName(): string {
    return ensureNonNullable(this._pluginName);
  }

  /**
   * Creates a new abstract file command handler.
   *
   * @param params - The parameters for the abstract file command handler.
   */
  public constructor(params: AbstractFileCommandHandlerParams) {
    super(params);
    this._fileMenuItemName = params.fileMenuItemName;
    this._fileMenuSection = params.fileMenuSection;
    this._fileMenuSubmenuIcon = params.fileMenuSubmenuIcon;
    this._filesMenuItemName = params.filesMenuItemName;
    this._filesMenuSection = params.filesMenuSection;
    this._filesMenuSubmenuIcon = params.filesMenuSubmenuIcon;
    this._shouldAddCommandToSubmenu = params.shouldAddCommandToSubmenu;
  }

  /**
   * Registers file-menu and files-menu event handlers.
   *
   * @param context - The registration context.
   */
  public override async onRegistered(context: CommandHandlerRegistrationContext): Promise<void> {
    await super.onRegistered(context);
    this._activeFileProvider = context.activeFileProvider;
    this._pluginName = context.pluginName;
    context.menuEventRegistrar.registerFileMenuEventHandler(this.handleAbstractFileMenu.bind(this));
    context.menuEventRegistrar.registerFilesMenuEventHandler(this.handleAbstractFilesMenu.bind(this));
  }

  /**
   * Checks whether the command can execute from the command palette.
   * Uses the active file as the target.
   *
   * @returns Whether the command can execute.
   */
  protected override canExecute(): boolean {
    if (!this._activeFileProvider) {
      return false;
    }

    if (!this.shouldAddToCommandPalette()) {
      return false;
    }

    const activeFile = this.getActiveFile();
    return !!activeFile && this.canExecuteAbstractFile(activeFile);
  }

  /**
   * Checks whether the command can execute for a single abstract file.
   *
   * @param _abstractFile - The file or folder.
   * @returns Whether the command can execute.
   */
  protected canExecuteAbstractFile(_abstractFile: TAbstractFile): boolean {
    return true;
  }

  /**
   * Checks whether the command can execute for multiple abstract files.
   * Default implementation checks each file individually.
   *
   * @param abstractFiles - The files or folders.
   * @returns Whether the command can execute.
   */
  protected canExecuteAbstractFiles(abstractFiles: TAbstractFile[]): boolean {
    return abstractFiles.length > 0 && abstractFiles.every((f) => this.canExecuteAbstractFile(f));
  }

  /**
   * Executes the command from the command palette using the active file.
   */
  protected override async execute(): Promise<void> {
    const activeFile = this.getActiveFile();
    if (activeFile) {
      await this.executeAbstractFile(activeFile);
    }
  }

  /**
   * Executes the command for a single abstract file.
   *
   * @param abstractFile - The file or folder.
   */
  protected abstract executeAbstractFile(abstractFile: TAbstractFile): Promisable<void>;

  /**
   * Executes the command for multiple abstract files.
   * Default implementation executes sequentially.
   *
   * @param abstractFiles - The files or folders.
   */
  protected async executeAbstractFiles(abstractFiles: TAbstractFile[]): Promise<void> {
    for (const file of abstractFiles) {
      await this.executeAbstractFile(file);
    }
  }

  /**
   * Checks whether the command should appear in the single-file context menu.
   *
   * @param _abstractFile - The file or folder.
   * @param _source - The source of the event.
   * @param _leaf - The workspace leaf, if available.
   * @returns Whether to add to the file menu.
   */
  protected shouldAddToAbstractFileMenu(_abstractFile: TAbstractFile, _source: string, _leaf?: WorkspaceLeaf): boolean {
    return false;
  }

  /**
   * Checks whether the command should appear in the multi-file context menu.
   * Default implementation checks each file individually.
   *
   * @param abstractFiles - The files or folders.
   * @param source - The source of the event.
   * @param leaf - The workspace leaf, if available.
   * @returns Whether to add to the files menu.
   */
  protected shouldAddToAbstractFilesMenu(abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): boolean {
    return abstractFiles.every((f) => this.shouldAddToAbstractFileMenu(f, source, leaf));
  }

  /**
   * Checks whether the command should appear in the command palette.
   *
   * @returns Whether to add to the command palette.
   */
  protected shouldAddToCommandPalette(): boolean {
    return true;
  }

  private getActiveFile(): null | TAbstractFile {
    return this.activeFileProvider.getActiveFile() ?? null;
  }

  private handleAbstractFileMenu(menu: Menu, abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf): void {
    if (!this.shouldAddToAbstractFileMenu(abstractFile, source, leaf)) {
      return;
    }

    if (!this.canExecuteAbstractFile(abstractFile)) {
      return;
    }

    const section = this.fileMenuSection ?? this.pluginName;
    if (this.shouldAddCommandToSubmenu) {
      menu.setSectionSubmenu(section, {
        icon: this.fileMenuSubmenuIcon ?? '',
        title: section
      });
    }

    menu.addItem((item) => {
      item
        .setTitle(this.fileMenuItemName ?? this.name)
        .setIcon(this.icon)
        .setSection(section)
        .onClick(() => {
          invokeAsyncSafely(() => this.executeAbstractFile(abstractFile));
        });
    });
  }

  private handleAbstractFilesMenu(menu: Menu, abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf): void {
    if (!this.shouldAddToAbstractFilesMenu(abstractFiles, source, leaf)) {
      return;
    }

    if (!this.canExecuteAbstractFiles(abstractFiles)) {
      return;
    }

    const section = this.filesMenuSection ?? this.fileMenuSection ?? this.pluginName;
    if (this.shouldAddCommandToSubmenu) {
      menu.setSectionSubmenu(section, {
        icon: this.filesMenuSubmenuIcon ?? this.fileMenuSubmenuIcon ?? '',
        title: section
      });
    }

    menu.addItem((item) => {
      item
        .setTitle(this.filesMenuItemName ?? this.fileMenuItemName ?? this.name)
        .setIcon(this.icon)
        .setSection(section)
        .onClick(() => {
          invokeAsyncSafely(() => this.executeAbstractFiles(abstractFiles));
        });
    });
  }
}
