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
import { ensureNonNullable } from '../../type-guards.ts';

/**
 * Parameters for creating a command handler.
 */
export interface CommandHandlerConstructorParams {
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

  /**
   * The name of the plugin that owns this command.
   */
  readonly pluginName: string;

  /**
   * Overrides the handler's own `shouldAddCommandToSubmenu`, or `undefined` to leave it alone.
   *
   * A menu surface that already wraps every contributed item in a plugin-titled parent entry — such as
   * `NotebookNavigatorMenuEventRegistrarComponent` — sets this to `false`, because a handler declaring
   * a section submenu of its own would make `Menu.sort()` nest a second plugin-titled entry inside the
   * first. Only `AbstractFileCommandHandler` reads it: the surfaces that need it bridge file and
   * folder menus, never the editor menu.
   */
  readonly shouldAddCommandToSubmenu?: boolean | undefined;
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
  protected readonly icon: IconName;

  /**
   * The ID of the command.
   */
  protected readonly id: string;

  /**
   * The display name of the command.
   */
  protected readonly name: string;

  /**
   * Gets the plugin name.
   *
   * @returns The plugin name.
   */
  protected get pluginName(): string {
    return ensureNonNullable(this._pluginName);
  }

  private _pluginName?: string;

  /**
   * Creates a new command handler.
   *
   * @param params - The parameters for the command handler.
   */
  public constructor(params: CommandHandlerConstructorParams) {
    this.icon = params.icon;
    this.id = params.id;
    this.name = params.name;
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
   * Throws when the same instance is registered twice. A handler stores per-registration state — the
   * plugin name here, the active-file provider and the submenu override in `AbstractFileCommandHandler`,
   * plus whatever a subclass records — and the menu closures registered here read that state lazily, at
   * menu-render time. So a second registration silently rewrites what the first registration's closures
   * will see. `CommandHandlerComponent` registers a handler set once per menu surface, which is why
   * `CommandHandlerFactory` must build FRESH instances on every call; this guard turns a factory that
   * hands out shared instances into a loud failure instead of a wrong context menu.
   *
   * @param context - The registration context providing runtime capabilities.
   */
  public async onRegistered(context: CommandHandlerRegistrationContext): Promise<void> {
    await noopAsync();
    if (this._pluginName !== undefined) {
      throw new Error(
        `Command handler '${this.id}' is already registered. A command handler instance cannot be registered twice - the command handler factory must build fresh instances on every call.`
      );
    }

    this._pluginName = context.pluginName;
  }
}
