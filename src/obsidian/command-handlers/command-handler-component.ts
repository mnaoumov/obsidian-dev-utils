/**
 * @file
 *
 * Component that registers {@link CommandHandler}s with Obsidian and ties their removal to its lifecycle.
 */

import type { ActiveFileProvider } from '../active-file-provider.ts';
import type { CommandRegistrar } from '../command-registrar.ts';
import type { MenuEventRegistrar } from '../menu-event-registrar.ts';
import type {
  CommandHandler,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { invokeAsyncSafely } from '../../async.ts';
import {
  CallbackDisposable,
  MultipleDisposeBehavior
} from '../../disposable.ts';
import { ComponentEx } from '../components/component-ex.ts';

interface CommandHandlerComponentConstructorParams {
  readonly activeFileProvider: ActiveFileProvider;
  readonly commandRegistrar: CommandRegistrar;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly pluginName: string;
}

/**
 * Registers {@link CommandHandler}s with Obsidian and manages their lifecycle.
 *
 * Call {@link registerCommandHandlers} to register a batch of handlers on demand (as many times as
 * needed while the component is alive); dispose the returned {@link Disposable} to unregister exactly
 * those handlers, or let the component unload to remove every command still registered through it.
 */
export class CommandHandlerComponent extends ComponentEx {
  /**
   * Provider for accessing the currently active file.
   */
  protected readonly activeFileProvider: ActiveFileProvider;

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
    this.activeFileProvider = params.activeFileProvider;
    this.menuEventRegistrar = params.menuEventRegistrar;
    this.commandRegistrar = params.commandRegistrar;
    this.pluginName = params.pluginName;
  }

  /**
   * Registers the given command handlers with Obsidian and provides each its runtime registration
   * context. Each handler's command is added immediately; the returned {@link Disposable} removes the
   * commands registered by this call when disposed. Any command still registered when the component
   * unloads is removed automatically.
   *
   * @param commandHandlers - The command handlers to register.
   * @returns A {@link Disposable} that unregisters the handlers passed to this call.
   */
  public registerCommandHandlers(commandHandlers: CommandHandler[]): Disposable {
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider: this.activeFileProvider,
      menuEventRegistrar: this.menuEventRegistrar,
      pluginName: this.pluginName
    };

    const disposables: Disposable[] = [];
    for (const commandHandler of commandHandlers) {
      const command = commandHandler.buildCommand();
      // Capture the id before registering. `Plugin.addCommand` mutates `command.id` (prefixing it with
      // `this.manifest.id`), while `Plugin.removeCommand` re-prefixes — so removal needs the original id.
      // Reading `command.id` after `addCommand` would double-prefix it, so the command is never removed.
      const commandId = command.id;
      this.commandRegistrar.addCommand(command);
      const disposable = new CallbackDisposable({
        callback: (): void => {
          this.commandRegistrar.removeCommand(commandId);
        },
        multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
      });
      disposables.push(disposable);
      // Tie removal to the component's unload, so a command never outlives the component.
      this.register(() => {
        disposable[Symbol.dispose]();
      });
      invokeAsyncSafely(() => commandHandler.onRegistered(context));
    }

    return new CallbackDisposable({
      callback: (): void => {
        for (const disposable of disposables) {
          disposable[Symbol.dispose]();
        }
      },
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
  }
}
