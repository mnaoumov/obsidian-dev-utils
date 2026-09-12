/**
 * @file
 *
 * Component that registers {@link CommandHandler}s with Obsidian and ties their removal to a chosen lifetime.
 */

import type { DisposableEx } from '../../disposable.ts';
import type { ActiveFileProvider } from '../active-file-provider.ts';
import type { CommandRegistrar } from '../command-registrar.ts';
import type {
  EditorMenuEventHandler,
  FileMenuEventHandler,
  FilesMenuEventHandler,
  MarkdownViewportMenuEventHandler,
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
 * throws on the second registration of an instance. {@link CommandHandlerComponent.registerCommandHandlers}
 * awaits it, so that throw rejects the caller's promise instead of degrading into a wrong context menu.
 *
 * @returns The command handlers to register. A NEW instance of each on every call.
 */
export type CommandHandlerFactory = () => CommandHandler[];

interface CommandHandlerComponentConstructorParams {
  readonly activeFileProvider: ActiveFileProvider;
  readonly additionalMenuEventRegistrars?: readonly MenuEventRegistrar[] | undefined;

  /**
   * Resolves the lifetime owner for a registration that names none of its own.
   *
   * When omitted, every registration is owned by the component itself, so its unload removes every command
   * it registered — the behavior a standalone component has always had. No `@default` tag, because the
   * effective default is a closure over `this` rather than a literal or a linkable symbol.
   */
  readonly commandLifetimeOwnerProvider?: CommandLifetimeOwnerProvider | undefined;
  readonly commandRegistrar: CommandRegistrar;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly pluginName: string;
}

interface CommandHandlerComponentRegisterCommandHandlersOptions {
  /**
   * The component whose unload removes the commands this call registers, overriding the component's
   * {@link CommandLifetimeOwnerProvider} for this one call.
   *
   * Name one when the batch's lifetime differs from the default — the caller that needs it is one
   * registering through a component whose default owner is some SHORTER-lived surface, and whose own
   * commands have to outlive it.
   */
  readonly lifetimeOwner?: ComponentEx | undefined;
}

interface CommandHandlerComponentRegisterMenuEventHandlersParams {
  readonly commandHandler: CommandHandler;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly shouldAddCommandToSubmenu?: boolean;
}

/**
 * Resolves the component that owns the teardown of the commands a {@link CommandHandlerComponent.registerCommandHandlers}
 * call registers — the one whose unload removes them from the palette.
 *
 * A provider rather than a component, because the owner is not stable for the life of the registering
 * component. `PluginBase` hands back the wrapper holding the plugin's feature surface, and that wrapper is
 * REPLACED wholesale every time the surface goes down and comes back (a declared dependency lost and
 * regained, a declared conflict appearing and being resolved). A value captured once would tie the second
 * cycle's commands to the first cycle's dead wrapper, where nothing would ever dispose them.
 *
 * @returns The component that should own the registration's teardown.
 */
type CommandLifetimeOwnerProvider = () => ComponentEx;

/**
 * A per-command {@link MenuEventRegistrar} that delegates to a shared registrar while collecting the
 * {@link DisposableEx} each registration returns, so disposing this scope unregisters exactly that command's
 * menu events. A handler may keep the scope past {@link CommandHandler.onRegistered} and register menu events
 * later — a bridge binding at layout-ready, say — so a registration that arrives after this scope was disposed
 * is disposed immediately instead of leaking.
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

  public registerMarkdownViewportMenuEventHandler(handler: MarkdownViewportMenuEventHandler): DisposableEx {
    return this.collect(this.inner.registerMarkdownViewportMenuEventHandler(handler));
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
 * those handlers — including any menu events they registered — or let the batch's LIFETIME OWNER unload to
 * remove every command still registered through it.
 *
 * That owner is this component by default, which is why a standalone component removes its own commands
 * when it unloads. It is overridable because the registering component and the registered commands do not
 * always share a lifetime: `PluginBase` keeps ONE of these running for the whole life of the plugin — it is
 * what the "your dependency went away" notice is built beside — while the commands a subclass registers from
 * `onloadImpl` belong to the feature surface the gate tears down and rebuilds underneath it. So the owner is
 * resolved per call, from a {@link CommandLifetimeOwnerProvider} or from the call's own `lifetimeOwner`.
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

  private readonly commandLifetimeOwnerProvider: CommandLifetimeOwnerProvider;

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
    this.commandLifetimeOwnerProvider = params.commandLifetimeOwnerProvider ?? ((): ComponentEx => this);
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
   * Which component's unload removes them is the caller's to choose: `options.lifetimeOwner` for this one
   * batch, otherwise whatever this component's {@link CommandLifetimeOwnerProvider} resolves to, which
   * defaults to the component itself. A command must never outlive the collaborators its handler closes
   * over — left on a longer-lived owner it stays in the palette calling into torn-down objects — so the
   * owner to name is the shortest-lived thing the batch depends on.
   *
   * @param commandHandlerFactory - Builds a fresh set of command handlers, once per menu surface.
   * @param options - The registration options.
   * @returns A {@link DisposableEx} that unregisters the handlers (commands + menu events) registered by this call.
   */
  public async registerCommandHandlers(commandHandlerFactory: CommandHandlerFactory, options?: CommandHandlerComponentRegisterCommandHandlersOptions): Promise<DisposableEx> {
    // Resolved per call, never captured at construction: a provider's answer changes over the component's
    // Life. `PluginBase` returns the wrapper holding the feature surface, and that wrapper is replaced
    // Wholesale on every gate cycle — so this cycle's commands have to land on this cycle's wrapper.
    const lifetimeOwner = options?.lifetimeOwner ?? this.commandLifetimeOwnerProvider();
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
      // Tie removal to the lifetime owner's unload, so a command never outlives what it calls into.
      disposables.push(lifetimeOwner.registerDisposable(disposable));
    }

    // Every additional surface gets its OWN handler instances — a handler carries per-registration
    // State, so one instance cannot serve two surfaces — and takes them with the section submenu
    // Forced off, because such a surface wraps everything in a plugin-titled parent entry of its own.
    for (const additionalMenuEventRegistrar of this.additionalMenuEventRegistrars) {
      for (const commandHandler of commandHandlerFactory()) {
        disposables.push(lifetimeOwner.registerDisposable(await this.registerMenuEventHandlers({ commandHandler, menuEventRegistrar: additionalMenuEventRegistrar, shouldAddCommandToSubmenu: false })));
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
