/**
 * @file
 *
 * Base class for Obsidian plugins using a component-based architecture.
 *
 * PluginBase registers universal components (context, i18n, error handling, abort signal, lifecycle events, debug).
 */

import type {
  App,
  Component,
  PluginManifest
} from 'obsidian';

import {
  Notice,
  Plugin as ObsidianPlugin
} from 'obsidian';

import type {
  PluginEventMap,
  PluginEventSource
} from './plugin-event-source.ts';

import { mixinAsyncEvents } from '../../async-events.ts';
import { printError } from '../../error.ts';
import { AbortSignalComponent } from '../components/abort-signal-component.ts';
import { AsyncErrorHandlerComponent } from '../components/async-error-handler-component.ts';
import { ComponentEx } from '../components/component-ex.ts';
import { ConsoleDebugComponent } from '../components/console-debug-component.ts';
import { I18nComponent } from '../components/i18n-component.ts';
import { PluginContextComponent } from '../components/plugin-context-component.ts';
import { PluginNoticeComponent } from '../components/plugin-notice-component.ts';

/**
 * Base class for creating Obsidian plugins with a component-based architecture.
 *
 * Registers universal components automatically. Subclasses add or replace components
 * via {@link PluginBase.addChild} in their constructor.
 */
export abstract class PluginBase extends mixinAsyncEvents<PluginEventMap>()(ObsidianPlugin) implements PluginEventSource {
  /**
   * Abort signal component.
   */
  protected abortSignalComponent: AbortSignalComponent;

  /**
   * Async error handler component.
   */
  protected asyncErrorHandlerComponent: AsyncErrorHandlerComponent;

  /**
   * Console debug component.
   */
  protected consoleDebugComponent: ConsoleDebugComponent;

  /**
   * I18n component.
   */
  protected i18nComponent: I18nComponent;

  /**
   * Plugin context component (plugin ID, debug controller, library styles).
   */
  protected pluginContextComponent: PluginContextComponent;

  /**
   * Plugin notice component.
   */
  protected pluginNoticeComponent: PluginNoticeComponent;

  private readonly wrapperComponent: ComponentEx;

  /**
   * Creates a new plugin.
   *
   * @param app - The Obsidian App instance.
   * @param manifest - The plugin manifest.
   */
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.wrapperComponent = super.addChild(new ComponentEx());

    this.pluginContextComponent = this.addChild(
      new PluginContextComponent({
        app: this.app,
        pluginId: this.manifest.id
      })
    );
    this.i18nComponent = this.addChild(new I18nComponent());
    this.pluginNoticeComponent = this.addChild(new PluginNoticeComponent(this.manifest.name));
    this.asyncErrorHandlerComponent = this.addChild(new AsyncErrorHandlerComponent(this.pluginNoticeComponent));
    this.abortSignalComponent = this.addChild(new AbortSignalComponent(this.manifest.id));
    this.consoleDebugComponent = this.addChild(new ConsoleDebugComponent(this.manifest.id));
  }

  /**
   * Adds a child component to the plugin.
   *
   * @typeParam TComponent - The type of component to add.
   * @param component - The component to add.
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
   */
  public override async onload(): Promise<void> {
    await this.wrapperComponent.loadWithPromises();
  }

  /**
   * Removes a child component from the plugin.
   *
   * @typeParam TComponent - The type of component to remove.
   * @param component - The component to remove.
   * @returns The removed component.
   */
  public override removeChild<TComponent extends Component>(component: TComponent): TComponent {
    return this.wrapperComponent.removeChild(component);
  }
}

/**
 * Reloads the specified plugin by disabling and then re-enabling it.
 *
 * @param plugin - The plugin to reload.
 * @returns A {@link Promise} that resolves when the plugin is reloaded.
 */
export async function reloadPlugin(plugin: ObsidianPlugin): Promise<void> {
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
export async function showErrorAndDisablePlugin(plugin: ObsidianPlugin, message: string): Promise<void> {
  new Notice(message);
  printError(new Error(message));
  await plugin.app.plugins.disablePlugin(plugin.manifest.id);
}
