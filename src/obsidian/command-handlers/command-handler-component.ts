/**
 * @file
 *
 * Component that wraps a {@link CommandHandler} and manages its registration with Obsidian.
 */

import type { ActiveFileProvider } from '../active-file-provider.ts';
import type { CommandRegistrar } from '../command-registrar.ts';
import type { MenuEventRegistrar } from '../menu-event-registrar.ts';
import type {
  CommandHandler,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { ComponentEx } from '../components/component-ex.ts';

interface CommandHandlerComponentConstructorParams {
  readonly activeFileProvider: ActiveFileProvider;
  readonly commandHandlers: CommandHandler[];
  readonly commandRegistrar: CommandRegistrar;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly pluginName: string;
}

/**
 * Wraps a {@link CommandHandler} and registers it with Obsidian on load.
 */
export class CommandHandlerComponent extends ComponentEx {
  /**
   * Provider for accessing the currently active file.
   */
  protected readonly activeFileProvider: ActiveFileProvider;

  /**
   * The command handlers to register with Obsidian.
   */
  protected readonly commandHandlers: CommandHandler[];

  /**
   * Registrar used to add and remove commands with Obsidian.
   */
  protected readonly commandRegistrar: CommandRegistrar;

  /**
   * Registrar for menu event handlers.
   */
  protected readonly menuEventRegistrar: MenuEventRegistrar;

  /**
   * The name of the plugin that owns the commands.
   */
  protected readonly pluginName: string;

  /**
   * Creates a new command handler component.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: CommandHandlerComponentConstructorParams) {
    super();
    this.commandHandlers = params.commandHandlers;
    this.activeFileProvider = params.activeFileProvider;
    this.menuEventRegistrar = params.menuEventRegistrar;
    this.commandRegistrar = params.commandRegistrar;
    this.pluginName = params.pluginName;
  }

  /**
   * Registers the command with Obsidian and provides runtime context to the handler.
   */
  public override async onloadAsync(): Promise<void> {
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider: this.activeFileProvider,
      menuEventRegistrar: this.menuEventRegistrar,
      pluginName: this.pluginName
    };

    for (const commandHandler of this.commandHandlers) {
      const command = commandHandler.buildCommand();
      this.commandRegistrar.addCommand(command);
      this.register(() => {
        this.commandRegistrar.removeCommand(command.id);
      });
      await commandHandler.onRegistered(context);
    }
  }
}
