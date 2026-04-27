/**
 * @file
 *
 * Base class and interfaces for command handlers.
 */

import type {
  Command,
  IconName
} from 'obsidian';

import type { ActiveFileProvider } from '../active-file-provider.ts';
import type { MenuEventRegistrar } from '../menu-event-registrar.ts';

import { noopAsync } from '../../function.ts';

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
