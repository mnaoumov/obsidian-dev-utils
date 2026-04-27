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

import { AsyncComponentBase } from '../components/async-component.ts';

interface CommandHandlerComponentConstructorParams {
  readonly activeFileProvider: ActiveFileProvider;
  readonly commandHandler: CommandHandler;
  readonly commandRegistrar: CommandRegistrar;
  readonly menuEventRegistrar: MenuEventRegistrar;
}

/**
 * Wraps a {@link CommandHandler} and registers it with Obsidian on load.
 */
export class CommandHandlerComponent extends AsyncComponentBase {
  private readonly activeFileProvider: ActiveFileProvider;
  private readonly commandHandler: CommandHandler;
  private readonly commandRegistrar: CommandRegistrar;
  private readonly menuEventRegistrar: MenuEventRegistrar;

  /**
   * Creates a new command handler component.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: CommandHandlerComponentConstructorParams) {
    super();
    this.commandHandler = params.commandHandler;
    this.activeFileProvider = params.activeFileProvider;
    this.menuEventRegistrar = params.menuEventRegistrar;
    this.commandRegistrar = params.commandRegistrar;
  }

  /**
   * Registers the command with Obsidian and provides runtime context to the handler.
   */
  public override async onload(): Promise<void> {
    this.commandRegistrar.addCommand(this.commandHandler.buildCommand());
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider: this.activeFileProvider,
      menuEventRegistrar: this.menuEventRegistrar
    };
    await this.commandHandler.onRegistered(context);
  }
}
