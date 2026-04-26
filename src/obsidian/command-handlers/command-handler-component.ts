/**
 * @file
 *
 * Component that wraps a {@link CommandHandler} and manages its registration with Obsidian.
 */

import type { Plugin } from 'obsidian';

import type {
  CommandHandler,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { AsyncComponentBase } from '../components/async-component.ts';
import { AppActiveFileProvider } from './app-active-file-provider.ts';
import { AppMenuEventRegistrar } from './app-menu-event-registrar.ts';

interface CommandHandlerComponentConstructorParams {
  readonly commandHandler: CommandHandler;
  readonly plugin: Plugin;
}

/**
 * Wraps a {@link CommandHandler} and registers it with Obsidian on load.
 */
export class CommandHandlerComponent extends AsyncComponentBase {
  private readonly commandHandler: CommandHandler;
  private readonly plugin: Plugin;

  /**
   * Creates a new command handler component.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: CommandHandlerComponentConstructorParams) {
    super();
    this.plugin = params.plugin;
    this.commandHandler = params.commandHandler;
  }

  /**
   * Registers the command with Obsidian and provides runtime context to the handler.
   */
  public override async onload(): Promise<void> {
    this.plugin.addCommand(this.commandHandler.buildCommand());
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider: new AppActiveFileProvider(this.plugin.app),
      menuEventRegistrar: new AppMenuEventRegistrar(this.plugin.app, this)
    };
    await this.commandHandler.onRegistered(context);
  }
}
