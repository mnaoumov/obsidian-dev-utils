/**
 * @file
 *
 * Base class for Obsidian plugins using a component-based architecture.
 *
 * PluginBase registers universal components (context, i18n, error handling, abort signal, lifecycle events, debug).
 */

import type { Component } from 'obsidian';
import type { Promisable } from 'type-fest';

import { Plugin } from 'obsidian';

import type { TranslationsMap } from '../i18n/i18n.ts';
import type {
  PluginEventMap,
  PluginEventSource
} from './plugin-event-source.ts';

import { mixinAsyncEvents } from '../../async-events.ts';
import { printError } from '../../error.ts';
import { noopAsync } from '../../function.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { AppActiveFileProvider } from '../active-file-provider.ts';
import { CommandHandlerComponent } from '../command-handlers/command-handler-component.ts';
import { UnlockActiveNoteCommandHandler } from '../command-handlers/unlock-active-note-command-handler.ts';
import { PluginCommandRegistrar } from '../command-registrar.ts';
import { AbortSignalComponent } from '../components/abort-signal-component.ts';
import { AsyncErrorHandlerComponent } from '../components/async-error-handler-component.ts';
import { ComponentEx } from '../components/component-ex.ts';
import { ConsoleDebugComponent } from '../components/console-debug-component.ts';
import { MenuEventRegistrarComponent } from '../components/menu-event-registrar-component.ts';
import { PluginContextComponent } from '../components/plugin-context-component.ts';
import { PluginNoticeComponent } from '../components/plugin-notice-component.ts';
import { initI18N } from '../i18n/i18n.ts';
import { defaultTranslationsMap } from '../i18n/locales/translations-map.ts';
import { ResourceLockComponent } from '../resource-lock.ts';

/**
 * Base class for creating Obsidian plugins with a component-based architecture.
 *
 * Registers universal components automatically. Subclasses add or replace components
 * via {@link removeChild} / {@link addChild}.
 */
export abstract class PluginBase extends mixinAsyncEvents<PluginEventMap>()(Plugin) implements PluginEventSource {
  /**
   * Gets abort signal component.
   *
   * @returns abort signal component.
   */
  protected get abortSignalComponent(): AbortSignalComponent {
    return ensureNonNullable(this._abortSignalComponent);
  }

  /**
   * Sets abort signal component.
   *
   * @param value - Abort signal component.
   */
  protected set abortSignalComponent(value: AbortSignalComponent) {
    this._abortSignalComponent = value;
  }

  /**
   * Gets async error handler component.
   *
   * @returns async error handler component.
   */
  protected get asyncErrorHandlerComponent(): AsyncErrorHandlerComponent {
    return ensureNonNullable(this._asyncErrorHandlerComponent);
  }

  /**
   * Sets async error handler component.
   *
   * @param value - Async error handler component.
   */
  protected set asyncErrorHandlerComponent(value: AsyncErrorHandlerComponent) {
    this._asyncErrorHandlerComponent = value;
  }

  /**
   * Gets the shared command handler component. Register a plugin's commands on it via
   * {@link CommandHandlerComponent.registerCommandHandlers} rather than constructing your own
   * {@link CommandHandlerComponent} — the app-backed active-file provider, command registrar, menu
   * event registrar, and plugin name are already wired.
   *
   * @returns The command handler component.
   */
  protected get commandHandlerComponent(): CommandHandlerComponent {
    return ensureNonNullable(this._commandHandlerComponent);
  }

  /**
   * Sets the command handler component.
   *
   * @param value - The command handler component.
   */
  protected set commandHandlerComponent(value: CommandHandlerComponent) {
    this._commandHandlerComponent = value;
  }

  /**
   * Gets console debug component.
   *
   * @returns console debug component.
   */
  protected get consoleDebugComponent(): ConsoleDebugComponent {
    return ensureNonNullable(this._consoleDebugComponent);
  }

  /**
   * Sets console debug component.
   *
   * @param value - Console debug component.
   */
  protected set consoleDebugComponent(value: ConsoleDebugComponent) {
    this._consoleDebugComponent = value;
  }

  /**
   * Gets plugin context component (plugin ID, debug controller, library styles).
   *
   * @returns plugin context component.
   */
  protected get pluginContextComponent(): PluginContextComponent {
    return ensureNonNullable(this._pluginContextComponent);
  }

  /**
   * Sets plugin context component.
   *
   * @param value - Plugin context component.
   */
  protected set pluginContextComponent(value: PluginContextComponent) {
    this._pluginContextComponent = value;
  }

  /**
   * Gets plugin notice component.
   *
   * @returns plugin notice component.
   */
  protected get pluginNoticeComponent(): PluginNoticeComponent {
    return ensureNonNullable(this._pluginNoticeComponent);
  }

  /**
   * Sets plugin notice component.
   *
   * @param value - Plugin notice component.
   */
  protected set pluginNoticeComponent(value: PluginNoticeComponent) {
    this._pluginNoticeComponent = value;
  }

  /**
   * Gets the editor lock component, used to lock notes read-only during long operations. Owned by
   * the plugin, so its locks are released automatically when the plugin unloads.
   *
   * @returns Editor lock component.
   */
  protected get resourceLockComponent(): ResourceLockComponent {
    return ensureNonNullable(this._resourceLockComponent);
  }

  /**
   * Sets the editor lock component.
   *
   * @param value - Editor lock component.
   */
  protected set resourceLockComponent(value: ResourceLockComponent) {
    this._resourceLockComponent = value;
  }

  private _abortSignalComponent?: AbortSignalComponent;

  private _asyncErrorHandlerComponent?: AsyncErrorHandlerComponent;

  private _commandHandlerComponent?: CommandHandlerComponent;

  private _consoleDebugComponent?: ConsoleDebugComponent;

  private _pluginContextComponent?: PluginContextComponent;

  private _pluginNoticeComponent?: PluginNoticeComponent;

  private _resourceLockComponent?: ResourceLockComponent;

  private readonly wrapperComponent = new ComponentEx();

  /**
   * Adds a child component.
   *
   * The child is added to an internal wrapper component so that, during {@link onloadImpl},
   * children are queued and then loaded sequentially (children-first) when the plugin loads.
   *
   * @typeParam TComponent - The type of component to add.
   * @param component - The component instance to add.
   * @returns The added component.
   */
  public override addChild<TComponent extends Component>(component: TComponent): TComponent {
    return this.wrapperComponent.addChild(component);
  }

  /**
   * Called when the external settings change.
   *
   * Override in subclass if needed. Make sure to call `await super.onExternalSettingsChange()` first.
   */
  public override async onExternalSettingsChange(): Promise<void> {
    await super.onExternalSettingsChange?.();
    await this.triggerAsync('externalSettingsChange');
  }

  /**
   * Called when the plugin is loaded.
   *
   * Orchestrates loading: registers the universal components, lets the subclass wire its own
   * components via {@link onloadImpl}, then loads all of them sequentially (children-first).
   *
   * Do NOT override this method. Override {@link onloadImpl} instead.
   */
  public override async onload(): Promise<void> {
    try {
      await initI18N(this.createTranslationsMap());
      this.pluginContextComponent = this.addChild(
        new PluginContextComponent({
          app: this.app,
          pluginId: this.manifest.id
        })
      );
      this.pluginNoticeComponent = this.addChild(
        new PluginNoticeComponent({
          app: this.app,
          pluginName: this.manifest.name
        })
      );
      this.asyncErrorHandlerComponent = this.addChild(new AsyncErrorHandlerComponent(this.pluginNoticeComponent));
      this.abortSignalComponent = this.addChild(new AbortSignalComponent(this.manifest.id));
      this.consoleDebugComponent = this.addChild(new ConsoleDebugComponent(this.manifest.id));
      this.resourceLockComponent = this.addChild(new ResourceLockComponent(this.app, this.manifest.id));
      this.commandHandlerComponent = this.addChild(
        new CommandHandlerComponent({
          activeFileProvider: new AppActiveFileProvider(this.app),
          commandRegistrar: new PluginCommandRegistrar(this),
          menuEventRegistrar: this.addChild(new MenuEventRegistrarComponent(this.app)),
          pluginName: this.manifest.name
        })
      );
      // Always available; the command's own `canExecute` hides it unless the active note is locked.
      this.commandHandlerComponent.registerCommandHandlers([
        new UnlockActiveNoteCommandHandler({
          app: this.app,
          resourceLockComponent: this.resourceLockComponent
        })
      ]);

      await this.onloadImpl();

      // Add the wrapper to the native plugin only now, after all children are queued.
      // The plugin is already loaded, so this loads the wrapper's children sequentially (children-first).
      // It also registers the wrapper for automatic teardown on plugin unload.
      super.addChild(this.wrapperComponent);
      await this.wrapperComponent.loadWithPromises();
    } catch (error) {
      printError(new Error(`Error loading plugin ${this.manifest.name} (${this.manifest.id})`, { cause: error }));
      throw error;
    }
  }

  /**
   * Removes a child component.
   *
   * @typeParam TComponent - The type of component to remove.
   * @param component - The component instance to remove.
   * @returns The removed component.
   */
  public override removeChild<TComponent extends Component>(component: TComponent): TComponent {
    return this.wrapperComponent.removeChild(component);
  }

  /**
   * Provides the translations map used to initialize i18n during {@link onload}.
   *
   * Override in subclass to supply plugin-specific translations. The default returns the built-in
   * `obsidian-dev-utils` translations.
   *
   * @returns The translations map.
   */
  protected createTranslationsMap(): TranslationsMap {
    return defaultTranslationsMap;
  }

  /**
   * Called during {@link onload} to wire plugin-specific child components.
   *
   * Override in subclass to add child components via {@link addChild}. The universal components are
   * available here. Children are loaded sequentially in the order they are added (children-first).
   *
   * @returns A {@link Promise} that resolves when the subclass load logic is complete.
   */
  protected onloadImpl(): Promisable<void> {
    return noopAsync();
  }
}

/**
 * Reloads the specified plugin by disabling and then re-enabling it.
 *
 * @param plugin - The plugin to reload.
 * @returns A {@link Promise} that resolves when the plugin is reloaded.
 */
export async function reloadPlugin(plugin: Plugin): Promise<void> {
  const plugins = plugin.app.plugins;
  const pluginId = plugin.manifest.id;
  await plugins.disablePlugin(pluginId);
  await plugins.enablePlugin(pluginId);
}

/**
 * Displays an error message as a notice, logs it to the console, and disables the specified plugin.
 *
 * @param plugin - The plugin to disable.
 * @param message - The error message to display and log.
 * @returns A {@link Promise} that resolves when the plugin is disabled.
 */
export async function showErrorAndDisablePlugin(plugin: Plugin, message: string): Promise<void> {
  const pluginNoticeComponent = new PluginNoticeComponent({
    app: plugin.app,
    pluginName: plugin.manifest.name
  });
  pluginNoticeComponent.showNotice(message);
  printError(new Error(message));
  await plugin.app.plugins.disablePlugin(plugin.manifest.id);
}
