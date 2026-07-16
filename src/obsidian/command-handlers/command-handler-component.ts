/**
 * @file
 *
 * Component that registers {@link CommandHandler}s with Obsidian and ties their removal to its lifecycle.
 */

import type { DisposableEx } from '../../disposable.ts';
import type { ActiveFileProvider } from '../active-file-provider.ts';
import type { CommandRegistrar } from '../command-registrar.ts';
import type {
  EditorMenuEventHandler,
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MenuEventRegistrar
} from '../menu-event-registrar.ts';
import type {
  CommandHandler,
  CommandHandlerRegistrationContext
} from './command-handler.ts';

import { invokeAsyncSafely } from '../../async.ts';
import {
  CallbackDisposable,
  CombineDisposable,
  DisposableBase
} from '../../disposable.ts';
import { ComponentEx } from '../components/component-ex.ts';

interface CommandHandlerComponentConstructorParams {
  readonly activeFileProvider: ActiveFileProvider;
  readonly commandRegistrar: CommandRegistrar;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly pluginName: string;
}

/**
 * A per-command {@link MenuEventRegistrar} that delegates to a shared registrar while collecting the
 * {@link DisposableEx} each registration returns, so disposing this scope unregisters exactly that command's
 * menu events. Because {@link CommandHandler.onRegistered} runs fire-and-forget (it may register menu events
 * after this scope has already been disposed), a registration that arrives post-dispose is disposed immediately
 * instead of leaking.
 */
class CommandMenuEventScope extends DisposableBase implements MenuEventRegistrar {
  private readonly disposables: DisposableEx[] = [];

  public constructor(private readonly inner: MenuEventRegistrar) {
    super();
  }

  public registerEditorMenuEventHandler(handler: EditorMenuEventHandler): DisposableEx {
    return this.collect(this.inner.registerEditorMenuEventHandler(handler));
  }

  public registerFileMenuEventHandler(handler: FileMenuEventHandler): DisposableEx {
    return this.collect(this.inner.registerFileMenuEventHandler(handler));
  }

  public registerFilesMenuEventHandler(handler: FilesMenuEventHandler): DisposableEx {
    return this.collect(this.inner.registerFilesMenuEventHandler(handler));
  }

  protected override performDispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }

  private collect(disposable: DisposableEx): DisposableEx {
    if (this.isDisposed) {
      disposable.dispose();
    } else {
      this.disposables.push(disposable);
    }

    return disposable;
  }
}

/**
 * Registers {@link CommandHandler}s with Obsidian and manages their lifecycle.
 *
 * Call {@link registerCommandHandlers} to register a batch of handlers on demand (as many times as
 * needed while the component is alive); dispose the returned {@link DisposableEx} to unregister exactly
 * those handlers — including any menu events they registered — or let the component unload to remove every
 * command still registered through it.
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
   * Registers the given command handlers with Obsidian and provides each its own runtime registration
   * context. Each handler's command is added immediately; the returned {@link DisposableEx} removes the
   * commands registered by this call — and any menu events those handlers registered via their context's
   * {@link MenuEventRegistrar} — when disposed. Any command still registered when the component unloads is
   * removed automatically.
   *
   * @param commandHandlers - The command handlers to register.
   * @returns A {@link DisposableEx} that unregisters the handlers (commands + menu events) passed to this call.
   */
  public registerCommandHandlers(commandHandlers: CommandHandler[]): DisposableEx {
    const disposables: Disposable[] = [];
    for (const commandHandler of commandHandlers) {
      const command = commandHandler.buildCommand();
      // Capture the id before registering. `Plugin.addCommand` mutates `command.id` (prefixing it with
      // `this.manifest.id`), while `Plugin.removeCommand` re-prefixes — so removal needs the original id.
      // Reading `command.id` after `addCommand` would double-prefix it, so the command is never removed.
      const commandId = command.id;
      this.commandRegistrar.addCommand(command);

      // Each command gets its own registration context with a per-command menu-event scope, so disposing one
      // Command tears down its own menu events without affecting the others.
      const menuEventScope = new CommandMenuEventScope(this.menuEventRegistrar);
      const context: CommandHandlerRegistrationContext = {
        activeFileProvider: this.activeFileProvider,
        menuEventRegistrar: menuEventScope,
        pluginName: this.pluginName
      };

      const disposable = new CallbackDisposable({
        callback: (): void => {
          this.commandRegistrar.removeCommand(commandId);
          menuEventScope.dispose();
        }
      });
      // Tie removal to the component's unload, so a command never outlives the component.
      disposables.push(this.registerDisposable(disposable));
      invokeAsyncSafely(() => commandHandler.onRegistered(context));
    }

    return new CombineDisposable({ disposables });
  }
}
