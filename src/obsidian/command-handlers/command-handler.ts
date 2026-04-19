/**
 * @file
 *
 * Base class and interfaces for command handlers.
 */

import type {
  Command,
  Editor,
  IconName,
  MarkdownFileInfo,
  Menu,
  TAbstractFile,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { noopAsync } from '../../function.ts';

/**
 * Provides access to the currently active file.
 */
export interface ActiveFileProvider {
  /**
   * Gets the currently active file.
   *
   * @returns The active file, or `null` if no file is active.
   */
  getActiveFile(): null | TFile;
}

/**
 * Parameters for creating a command handler.
 */
export interface CommandHandlerParams {
  /**
   * The icon for the command.
   */
  readonly icon: IconName;

  /**
   * The ID of the command.
   */
  readonly id: string;

  /**
   * The display name of the command.
   */
  readonly name: string;

  /**
   * The name of the plugin that owns this command.
   */
  readonly pluginName: string;
}

/**
 * Context provided to command handlers during registration.
 */
export interface CommandHandlerRegistrationContext {
  /**
   * Provider for accessing the currently active file.
   */
  readonly activeFileProvider: ActiveFileProvider;

  /**
   * Registrar for menu event handlers.
   */
  readonly menuEventRegistrar: MenuEventRegistrar;
}

/**
 * Handler for the editor context menu event.
 *
 * @param menu - The menu to add items to.
 * @param editor - The editor instance.
 * @param ctx - The markdown file context.
 */
export type EditorMenuEventHandler = (menu: Menu, editor: Editor, ctx: MarkdownFileInfo) => void;

/**
 * Handler for the single-file context menu event.
 *
 * @param menu - The menu to add items to.
 * @param abstractFile - The file or folder.
 * @param source - The source of the event.
 * @param leaf - The workspace leaf, if available.
 */
export type FileMenuEventHandler = (menu: Menu, abstractFile: TAbstractFile, source: string, leaf?: WorkspaceLeaf) => void;

/**
 * Handler for the multi-file context menu event.
 *
 * @param menu - The menu to add items to.
 * @param abstractFiles - The files or folders.
 * @param source - The source of the event.
 * @param leaf - The workspace leaf, if available.
 */
export type FilesMenuEventHandler = (menu: Menu, abstractFiles: TAbstractFile[], source: string, leaf?: WorkspaceLeaf) => void;

/**
 * Registers menu event handlers with lifecycle management.
 */
export interface MenuEventRegistrar {
  /**
   * Registers a handler for the editor context menu event.
   *
   * @param handler - The handler to register.
   */
  registerEditorMenuEventHandler(handler: EditorMenuEventHandler): void;

  /**
   * Registers a handler for the single-file context menu event.
   *
   * @param handler - The handler to register.
   */
  registerFileMenuEventHandler(handler: FileMenuEventHandler): void;

  /**
   * Registers a handler for the multi-file context menu event.
   *
   * @param handler - The handler to register.
   */
  registerFilesMenuEventHandler(handler: FilesMenuEventHandler): void;
}

/**
 * Base class for command handlers.
 *
 * Unlike the Obsidian {@link Command} interface, handlers are never mutated by Obsidian.
 * The {@link buildCommand} method produces a plain {@link Command} object for registration.
 */
export abstract class CommandHandler {
  /**
   * The icon for the command.
   */
  public readonly icon: IconName;

  /**
   * The ID of the command.
   */
  public readonly id: string;

  /**
   * The display name of the command.
   */
  public readonly name: string;

  /**
   * The name of the plugin that owns this command.
   */
  protected readonly pluginName: string;

  /**
   * Creates a new command handler.
   *
   * @param params - The parameters for the command handler.
   */
  public constructor(params: CommandHandlerParams) {
    this.icon = params.icon;
    this.id = params.id;
    this.name = params.name;
    this.pluginName = params.pluginName;
  }

  /**
   * Builds a plain Obsidian {@link Command} object for registration.
   *
   * @returns A new {@link Command} object. Obsidian may mutate this object after registration.
   */
  public abstract buildCommand(): Command;

  /**
   * Called after the command has been registered with Obsidian.
   * Subclasses use the provided context to register menu event handlers.
   *
   * @param _context - The registration context providing runtime capabilities.
   */
  public async onRegistered(_context: CommandHandlerRegistrationContext): Promise<void> {
    await noopAsync();
  }
}
