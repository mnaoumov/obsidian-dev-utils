/**
 * @file
 *
 * Base class for Obsidian plugins using a component-based architecture.
 *
 * PluginBase registers universal components (context, i18n, error handling, abort signal, lifecycle events, debug).
 * Subclasses add their own components via {@link registerComponent} in their constructor.
 * Any universal component can be replaced by calling {@link registerComponent} with a new instance of the same class.
 */

import type {
  App,
  PluginManifest
} from 'obsidian';

import {
  Component,
  Notice,
  Plugin as ObsidianPlugin
} from 'obsidian';

import type { LayoutReadyComponent } from './components/layout-ready-component.ts';
import type { PluginSettingsComponentBase } from './components/plugin-settings-component.ts';

import { invokeAsyncSafelyAfterDelay } from '../../async.ts';
import { printError } from '../../error.ts';
import { bypassStrictProxy } from '../../strict-proxy.ts';
import { loadChildrenFirstAsync } from '../components/async-component.ts';
import { AbortSignalComponent } from './components/abort-signal-component.ts';
import { AsyncErrorHandlerComponent } from './components/async-error-handler-component.ts';
import { ConsoleDebugComponent } from './components/console-debug-component.ts';
import { I18nComponent } from './components/i18n-component.ts';
import { PluginContextComponent } from './components/plugin-context-component.ts';
import { PluginNoticeComponent } from './components/plugin-notice-component.ts';
import { EmptyPluginSettingsComponent } from './components/plugin-settings-component.ts';

interface ComponentClassWithKey {
  COMPONENT_KEY: symbol;
}

/**
 * Base class for creating Obsidian plugins with a component-based architecture.
 *
 * Registers universal components automatically. Subclasses add or replace components
 * via {@link registerComponent} in their constructor.
 */
export abstract class PluginBase extends ObsidianPlugin {
  /**
   * The abort signal component. Aborted when the plugin is unloaded.
   */
  protected readonly abortSignalComponent: AbortSignalComponent;

  /**
   * The console debug component. Provides namespaced debug logging.
   */
  protected readonly consoleDebugComponent: ConsoleDebugComponent;

  /**
   * The notice component. Displays notices to the user.
   */
  protected readonly noticeComponent: PluginNoticeComponent;

  /**
   * The settings component. Manages plugin settings lifecycle.
   */
  protected readonly settingsComponent: PluginSettingsComponentBase<object>;

  private readonly singletonComponents = new Map<symbol, Component>();

  /**
   * Creates a new PluginBase.
   *
   * @param app - The Obsidian app instance.
   * @param manifest - The plugin manifest.
   */
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);

    this.addChild(new PluginContextComponent({ app, pluginId: manifest.id }));
    this.addChild(new I18nComponent());
    this.noticeComponent = this.addChild(new PluginNoticeComponent(manifest.name));
    this.addChild(new AsyncErrorHandlerComponent(this.noticeComponent));
    this.abortSignalComponent = this.addChild(new AbortSignalComponent(manifest.id));
    this.consoleDebugComponent = this.addChild(new ConsoleDebugComponent(manifest.id));
    this.settingsComponent = this.addChild(new EmptyPluginSettingsComponent());
  }

  /**
   * Adds a component to the plugin.
   *
   * If the component's class defines a static `COMPONENT_KEY` symbol, it is treated as a singleton —
   * adding another component with the same key replaces the previous one.
   * Components without a `COMPONENT_KEY` are multi-instance and simply added.
   *
   * @typeParam T - The component type.
   * @param component - The component to add.
   * @returns The added component.
   */
  public override addChild<T extends Component>(component: T): T {
    if (this._loaded) {
      return super.addChild(component);
    }

    const singletonKey = (component.constructor as Partial<ComponentClassWithKey>).COMPONENT_KEY;

    if (singletonKey) {
      const oldComponent = this.singletonComponents.get(singletonKey);
      if (oldComponent) {
        this.removeChild(oldComponent);
      }
      this.singletonComponents.set(singletonKey, component);
    }

    return super.addChild(component);
  }

  /**
   * Loads the plugin and its components.
   */
  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Obsidian's load() handles async returns at runtime.
  public override async load(): Promise<void> {
    await loadChildrenFirstAsync(this);
    this.app.workspace.onLayoutReady(() => {
      invokeAsyncSafelyAfterDelay(
        async () => {
          for (const child of this._children) {
            await (bypassStrictProxy(child) as Partial<LayoutReadyComponent>).onLayoutReady?.();
          }
        },
        0,
        undefined,
        this.abortSignalComponent.abortSignal
      );
    });
  }

  /**
   * Called when the external settings change.
   *
   * Override in subclass if needed. Make sure to call `await super.onExternalSettingsChange()` first.
   */
  public override async onExternalSettingsChange(): Promise<void> {
    await super.onExternalSettingsChange?.();
    await this.settingsComponent.onExternalSettingsChange();
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
