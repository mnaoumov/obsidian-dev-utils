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

import {
  CallbackDisposable,
  CombineDisposable,
  DisposableBase
} from '../../disposable.ts';
import { ComponentEx } from '../components/component-ex.ts';

/**
 * Builds a fresh set of {@link CommandHandler}s.
 *
 * A factory rather than a ready-made array because {@link CommandHandlerComponent} registers the same
 * handlers against several menu surfaces, and a handler carries per-registration state (its
 * active-file provider, its plugin name, and whatever a subclass records in
 * {@link CommandHandler.onRegistered}) — so every surface needs its own instances.
 *
 * Returning shared instances (`() => [handler1Singleton, handler2Singleton]`) reintroduces exactly the
 * bug the factory exists to avoid, so it is not merely discouraged: {@link CommandHandler.onRegistered}
 * throws on the second registration of an instance. Because {@link CommandHandler.onRegistered} runs
 * fire-and-forget, that throw surfaces as an async error event rather than failing the caller.
 *
 * @returns The command handlers to register. A NEW instance of each on every call.
 */
export type CommandHandlerFactory = () => CommandHandler[];

interface CommandHandlerComponentConstructorParams {
  readonly activeFileProvider: ActiveFileProvider;
  readonly additionalMenuEventRegistrars?: readonly MenuEventRegistrar[] | undefined;
  readonly commandRegistrar: CommandRegistrar;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly pluginName: string;
}

interface CommandHandlerComponentRegisterMenuEventHandlersParams {
  readonly commandHandler: CommandHandler;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly shouldAddCommandToSubmenu?: boolean;
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
 *
 * The same handlers are fed to every menu surface the component knows about: Obsidian's own workspace
 * events, plus each additional {@link MenuEventRegistrar} bridging another plugin's menus.
 */
export class CommandHandlerComponent extends ComponentEx {
  /**
   * Provider for accessing the currently active file.
   */
  protected readonly activeFileProvider: ActiveFileProvider;

  /**
   * Registrars for menu surfaces that build their own plugin-titled parent entry, and therefore take
   * the handlers with their section submenu forced off.
   */
  protected readonly additionalMenuEventRegistrars: readonly MenuEventRegistrar[];

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
    this.additionalMenuEventRegistrars = params.additionalMenuEventRegistrars ?? [];
    this.commandRegistrar = params.commandRegistrar;
    this.pluginName = params.pluginName;
  }

  /**
   * Builds the command handlers and registers them with Obsidian, giving each its own runtime
   * registration context. Each handler's command is added immediately; the returned
   * {@link DisposableEx} removes the commands registered by this call — and any menu events those
   * handlers registered via their context's {@link MenuEventRegistrar} — when disposed. Any command
   * still registered when the component unloads is removed automatically.
   *
   * The factory is invoked once more for every additional menu surface, so a plugin declares its
   * handlers ONCE and all surfaces are fed. Those extra passes add no commands — the palette already
   * has every command from the first pass.
   *
   * @param commandHandlerFactory - Builds a fresh set of command handlers, once per menu surface.
   * @returns A {@link DisposableEx} that unregisters the handlers (commands + menu events) registered by this call.
   */
  public async registerCommandHandlers(commandHandlerFactory: CommandHandlerFactory): Promise<DisposableEx> {
    const disposables: Disposable[] = [];
    for (const commandHandler of commandHandlerFactory()) {
      const command = commandHandler.buildCommand();
      // Capture the id before registering. `Plugin.addCommand` mutates `command.id` (prefixing it with
      // `this.manifest.id`), while `Plugin.removeCommand` re-prefixes — so removal needs the original id.
      // Reading `command.id` after `addCommand` would double-prefix it, so the command is never removed.
      const commandId = command.id;
      this.commandRegistrar.addCommand(command);

      // Each command gets its own registration context with a per-command menu-event scope, so disposing one
      // Command tears down its own menu events without affecting the others.
      const menuEventScope = await this.registerMenuEventHandlers({ commandHandler, menuEventRegistrar: this.menuEventRegistrar });

      const disposable = new CallbackDisposable({
        callback: (): void => {
          this.commandRegistrar.removeCommand(commandId);
          menuEventScope.dispose();
        }
      });
      // Tie removal to the component's unload, so a command never outlives the component.
      disposables.push(this.registerDisposable(disposable));
    }

    // Every additional surface gets its OWN handler instances — a handler carries per-registration
    // State, so one instance cannot serve two surfaces — and takes them with the section submenu
    // Forced off, because such a surface wraps everything in a plugin-titled parent entry of its own.
    for (const additionalMenuEventRegistrar of this.additionalMenuEventRegistrars) {
      for (const commandHandler of commandHandlerFactory()) {
        disposables.push(this.registerDisposable(await this.registerMenuEventHandlers({ commandHandler, menuEventRegistrar: additionalMenuEventRegistrar, shouldAddCommandToSubmenu: false })));
      }
    }

    return new CombineDisposable({ disposables });
  }

  /**
   * Hands a command handler its registration context, scoped so that disposing the returned scope
   * unregisters exactly the menu events that handler registered.
   *
   * @param params - The parameters for this registration.
   * @returns The handler's menu-event scope.
   */
  private async registerMenuEventHandlers(params: CommandHandlerComponentRegisterMenuEventHandlersParams): Promise<CommandMenuEventScope> {
    const menuEventScope = new CommandMenuEventScope(params.menuEventRegistrar);
    const context: CommandHandlerRegistrationContext = {
      activeFileProvider: this.activeFileProvider,
      menuEventRegistrar: menuEventScope,
      pluginName: this.pluginName,
      shouldAddCommandToSubmenu: params.shouldAddCommandToSubmenu
    };
    await params.commandHandler.onRegistered(context);
    return menuEventScope;
  }
}
