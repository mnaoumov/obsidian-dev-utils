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
import type { Promisable } from 'type-fest';

import {
  Component,
  Notice,
  Plugin as ObsidianPlugin
} from 'obsidian';

import type { PluginSettingsComponentBase } from './components/plugin-settings-component.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafelyAfterDelay
} from '../../async.ts';
import { printError } from '../../error.ts';
import { noopAsync } from '../../function.ts';
import { AbortSignalComponent } from './components/abort-signal-component.ts';
import { AsyncErrorHandlerComponent } from './components/async-error-handler-component.ts';
import { ConsoleDebugComponent } from './components/console-debug-component.ts';
import { I18nComponent } from './components/i18n-component.ts';
import { LifecycleEventsComponent } from './components/lifecycle-events-component.ts';
import { PluginContextComponent } from './components/plugin-context-component.ts';
import { PluginNoticeComponent } from './components/plugin-notice-component.ts';
import { EmptyPluginSettingsComponent } from './components/plugin-settings-component.ts';

/**
 * Params for {@link PluginBase.registerComponent}.
 *
 * @typeParam T - The component type.
 */
export interface RegisterComponentParams<T extends Component = Component> {
  /**
   * The component to register.
   */
  readonly component: T;

  /**
   * Whether this component should be loaded before the plugin's `onloadImpl()` runs.
   * Components marked with this flag are force-loaded during `onload()`, ensuring they are
   * fully initialized before plugin logic executes.
   */
  readonly shouldPreload?: boolean;
}

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
   * The lifecycle events component. Provides load, layoutReady, and unload events.
   */
  protected readonly lifecycleEventsComponent: LifecycleEventsComponent;

  /**
   * The notice component. Displays notices to the user.
   */
  protected readonly noticeComponent: PluginNoticeComponent;

  /**
   * The settings component. Manages plugin settings lifecycle.
   */
  protected readonly settingsComponent: PluginSettingsComponentBase<object>;

  private readonly preloadComponents: Component[] = [];
  private readonly singletonComponents = new Map<symbol, Component>();

  /**
   * Creates a new PluginBase.
   *
   * @param app - The Obsidian app instance.
   * @param manifest - The plugin manifest.
   */
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);

    this.registerComponent({ component: new PluginContextComponent(app, manifest.id), shouldPreload: true });
    this.registerComponent({ component: new I18nComponent(), shouldPreload: true });
    this.noticeComponent = this.registerComponent({ component: new PluginNoticeComponent(manifest.name) });
    this.registerComponent({ component: new AsyncErrorHandlerComponent(this.noticeComponent) });
    this.abortSignalComponent = this.registerComponent({ component: new AbortSignalComponent(manifest.id) });
    this.consoleDebugComponent = this.registerComponent({ component: new ConsoleDebugComponent(manifest.id) });
    this.lifecycleEventsComponent = this.registerComponent({ component: new LifecycleEventsComponent(app) });
    this.settingsComponent = this.registerComponent({ component: new EmptyPluginSettingsComponent(), shouldPreload: true });
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

  /**
   * Called when the plugin is loaded. Force-loads components that must be ready
   * before plugin logic, then calls `onloadImpl()`.
   *
   * Usually, you don't need to override this method. Override {@link onloadImpl} instead.
   */
  public override async onload(): Promise<void> {
    await super.onload();

    for (const component of this.preloadComponents) {
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- Component.load() returns void|Promise at runtime despite void typing.
      await (component.load() as Promisable<void>);
    }

    await this.onloadImpl();
    invokeAsyncSafelyAfterDelay(this.afterLoad.bind(this));
  }

  /**
   * Called when the layout is ready.
   */
  protected async onLayoutReady(): Promise<void> {
    await noopAsync();
  }

  /**
   * Called after all pre-load components are initialized. Override this to add plugin-specific logic.
   *
   * @remarks It is important to call `super.onloadImpl()` in overridden method.
   */
  protected async onloadImpl(): Promise<void> {
    await noopAsync();
  }

  /**
   * Registers a component with the plugin.
   *
   * If the component's class defines a static `COMPONENT_KEY` symbol, it is treated as a singleton —
   * registering another component with the same key replaces the previous one.
   * Components without a `COMPONENT_KEY` are multi-instance and simply added.
   *
   * @typeParam T - The component type.
   * @param params - The registration params.
   * @returns The registered component.
   */
  protected registerComponent<T extends Component>(params: RegisterComponentParams<T>): T {
    const singletonKey = (params.component.constructor as Partial<ComponentClassWithKey>).COMPONENT_KEY;

    if (singletonKey) {
      const oldComponent = this.singletonComponents.get(singletonKey);
      if (oldComponent) {
        this.removeChild(oldComponent);
        const preloadIndex = this.preloadComponents.indexOf(oldComponent);
        if (preloadIndex !== -1) {
          this.preloadComponents.splice(preloadIndex, 1);
        }
      }
      this.singletonComponents.set(singletonKey, params.component);
    }

    this.addChild(params.component);

    if (params.shouldPreload) {
      this.preloadComponents.push(params.component);
    }

    return params.component;
  }

  private async afterLoad(): Promise<void> {
    if (this.abortSignalComponent.abortSignal.aborted) {
      return;
    }
    await this.lifecycleEventsComponent.triggerLifecycleEvent('load');
    this.app.workspace.onLayoutReady(convertAsyncToSync(this.onLayoutReadyBase.bind(this)));
  }

  private async onLayoutReadyBase(): Promise<void> {
    try {
      await this.onLayoutReady();
    } finally {
      await this.lifecycleEventsComponent.triggerLifecycleEvent('layoutReady');
    }
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
