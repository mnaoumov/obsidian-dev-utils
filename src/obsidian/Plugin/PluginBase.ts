/**
 * @packageDocumentation
 *
 * Base class for Obsidian plugins providing utility methods for settings management, error handling, and notifications.
 *
 * This class simplifies the process of managing plugin settings, displaying notifications, and handling errors.
 * Subclasses should implement methods to create default settings and settings tabs, and complete plugin-specific
 * loading tasks.
 */

import type { PluginSettingTab } from 'obsidian';
import type {
  Promisable,
  ReadonlyDeep
} from 'type-fest';

import {
  Notice,
  Plugin as ObsidianPlugin
} from 'obsidian';

import type { AsyncEventRef } from '../../AsyncEvents.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely,
  invokeAsyncSafelyAfterDelay
} from '../../Async.ts';
import { AsyncEvents } from '../../AsyncEvents.ts';
import { getDebugger } from '../../Debug.ts';
import { registerAsyncErrorEventHandler } from '../../Error.ts';
import { noop } from '../../Function.ts';
import { initPluginContext } from './PluginContext.ts';
import { PluginSettingsManagerBase } from './PluginSettingsManagerBase.ts';

/**
 * Extracts the plugin settings type from the plugin base class.
 *
 * @typeParam Plugin - The plugin class.
 * @returns The plugin settings type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtractPluginSettings<Plugin extends PluginBase<any>> = Plugin['__pluginSettingsType'];

type LifecycleEventName = 'layoutReady' | 'load' | 'unload';

/**
 * Base class for creating Obsidian plugins with built-in support for settings management, error handling, and notifications.
 *
 * @typeParam PluginSettings - The type representing the plugin settings object.
 */
export abstract class PluginBase<PluginSettings extends object = object> extends ObsidianPlugin {
  /**
   * @deprecated Used only for type inference. Don't use it directly.
   */
  declare public __pluginSettingsType: PluginSettings;

  public readonly events = new AsyncEvents();

  /**
   * Gets the AbortSignal used for aborting long-running operations.
   *
   * @returns The abort signal.
   */
  public get abortSignal(): AbortSignal {
    return this._abortSignal;
  }

  /**
   * Gets the readonly plugin settings.
   *
   * @returns The readonly plugin settings.
   */
  public get settings(): ReadonlyDeep<PluginSettings> {
    return this.settingsManager.safeSettings;
  }

  public get settingsManager(): PluginSettingsManagerBase<this> {
    if (!this._settingsManager) {
      throw new Error('Settings manager not defined');
    }

    return this._settingsManager;
  }

  private _abortSignal!: AbortSignal;
  private _settingsManager: null | PluginSettingsManagerBase<this> = null;
  private lifecycleEventNames = new Set<LifecycleEventName>();
  private notice?: Notice;

  /**
   * Logs a message to the console.
   *
   * Use instead of `console.debug()`.
   *
   * Those messages are not shown by default, but they can be shown by enabling `your-plugin-id` debugger namespace.
   *
   * @see {@link https://github.com/mnaoumov/obsidian-dev-utils/?tab=readme-ov-file#debugging} for more information.
   *
   * @param message - The message to log.
   * @param args - The arguments to log.
   */
  public consoleDebug(message: string, ...args: unknown[]): void {
    // Skip the `consoleDebug()` call itself
    const FRAMES_TO_SKIP = 1;
    const _debugger = getDebugger(this.manifest.id, FRAMES_TO_SKIP);
    _debugger(message, ...args);
  }

  /**
   * Called when the external settings change.
   */
  public override async onExternalSettingsChange(): Promise<void> {
    await super.onExternalSettingsChange?.();
    await this.settingsManager.loadFromFile();
  }

  /**
   * Called when the plugin is loaded
   */
  public override async onload(): Promise<void> {
    await super.onload();
    await this.onloadImpl();
    invokeAsyncSafelyAfterDelay(this.afterLoad.bind(this));
  }

  /**
   * Called when the plugin settings are loaded or reloaded.
   *
   * @param _settings - The settings.
   */
  public onLoadSettings(_settings: PluginSettings): Promisable<void> {
    noop();
  }

  /**
   * Called when the plugin settings are saved.
   *
   * @param _newSettings - The new settings.
   * @param _oldSettings - The old settings.
   */
  public onSaveSettings(_newSettings: PluginSettings, _oldSettings: PluginSettings): Promisable<void> {
    noop();
  }

  public override onunload(): void {
    super.onunload();
    invokeAsyncSafely(async () => {
      try {
        await this.onunloadImpl();
      } finally {
        await this.triggerLifecycleEvent('unload');
      }
    });
  }

  /**
   * Registers an async event.
   * Unregisters the event when the plugin is unloaded.
   *
   * @param eventRef - The event reference.
   */
  public registerAsyncEvent(eventRef: AsyncEventRef): void {
    this.register(() => {
      eventRef.asyncEvents.offref(eventRef);
    });
  }

  /**
   * Waits for a lifecycle event to be triggered.
   *
   * If you `await` this method during lifecycle event, it might cause a deadlock.
   *
   * Consider wrapping this call with {@link invokeAsyncSafely}.
   *
   * @param name - The name of the event.
   * @returns A {@link Promise} that resolves when the event is triggered.
   */
  public async waitForLifecycleEvent(name: LifecycleEventName): Promise<void> {
    if (this.lifecycleEventNames.has(name)) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.events.once(name, () => {
        resolve();
      });
    });
  }

  /**
   * Creates a plugin settings tab.
   *
   * @returns The settings tab or null if not applicable.
   */
  protected createPluginSettingsTab(): null | PluginSettingTab {
    return null;
  }

  /**
   * Creates the plugin settings manager. This method must be implemented by subclasses.
   *
   * @returns The plugin settings manager.
   */
  protected createSettingsManager(): null | PluginSettingsManagerBase<this> {
    return null;
  }

  /**
   * Called when the layout is ready. This method can be overridden by subclasses to perform actions once
   * the layout is ready.
   */
  protected onLayoutReady(): Promisable<void> {
    noop();
  }

  protected async onloadImpl(): Promise<void> {
    initPluginContext(this.app, this.manifest.id);

    this.register(registerAsyncErrorEventHandler(() => {
      this.showNotice('An unhandled error occurred. Please check the console for more information.');
    }));

    this._settingsManager = this.createSettingsManager();

    await this.onExternalSettingsChange();
    const pluginSettingsTab = this.createPluginSettingsTab();
    if (pluginSettingsTab) {
      this.addSettingTab(pluginSettingsTab);
    }

    const abortController = new AbortController();
    this._abortSignal = abortController.signal;
    this.register(() => {
      abortController.abort();
    });
  }

  /**
   * Called when the plugin is unloaded.
   */
  protected onunloadImpl(): Promisable<void> {
    noop();
  }

  /**
   * Displays a notice message to the user.
   *
   * @param message - The message to display.
   */
  protected showNotice(message: string): void {
    if (this.notice) {
      this.notice.hide();
    }

    this.notice = new Notice(`${this.manifest.name}\n${message}`);
  }

  private async afterLoad(): Promise<void> {
    await this.triggerLifecycleEvent('load');
    this.app.workspace.onLayoutReady(convertAsyncToSync(this.onLayoutReadyBase.bind(this)));
  }

  private async onLayoutReadyBase(): Promise<void> {
    try {
      await this.onLayoutReady();
    } finally {
      await this.triggerLifecycleEvent('layoutReady');
    }
  }

  private async triggerLifecycleEvent(name: LifecycleEventName): Promise<void> {
    this.lifecycleEventNames.add(name);
    await this.events.triggerAsync(name);
  }
}
