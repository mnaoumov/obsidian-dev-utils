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

/**
 * Wraps a {@link CommandHandler} and registers it with Obsidian on load.
 */
export class CommandHandlerComponent extends AsyncComponentBase {
  /**
   * Creates a new command handler component.
   *
   * @param plugin - The Obsidian plugin instance.
   * @param handler - The command handler to register.
   */
  public constructor(
    private readonly plugin: Plugin,
    public readonly handler: CommandHandler
  ) {
    super();
  }

  /**
   * Registers the command with Obsidian and provides runtime context to the handler.
   */
  public override async onload(): Promise<void> {
    this.plugin.addCommand(this.handler.buildCommand());
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider: new AppActiveFileProvider(this.plugin.app),
      menuEventRegistrar: new AppMenuEventRegistrar(this.plugin.app, this)
    };
    await this.handler.onRegistered(context);
  }
}
