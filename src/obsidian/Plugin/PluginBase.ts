/**
 * @packageDocumentation PluginBase
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
  Plugin
} from 'obsidian';

import type { AsyncEventRef } from '../../AsyncEvents.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../Async.ts';
import { AsyncEvents } from '../../AsyncEvents.ts';
import { getDebugger } from '../../Debug.ts';
import { registerAsyncErrorEventHandler } from '../../Error.ts';
import { noop } from '../../Function.ts';
import { initPluginContext } from './PluginContext.ts';
import { PluginSettingsManagerBase } from './PluginSettingsManagerBase.ts';

type LifecycleEventName = 'layoutReady' | 'loadComplete' | 'unload';

/**
 * Base class for creating Obsidian plugins with built-in support for settings management, error handling, and notifications.
 *
 * @typeParam PluginSettings - The type representing the plugin settings object.
 */
export abstract class PluginBase<PluginSettings extends object = object> extends Plugin {
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

  public get settingsManager(): PluginSettingsManagerBase<PluginSettings> {
    if (!this._settingsManager) {
      throw new Error('Settings manager not defined');
    }

    return this._settingsManager;
  }

  private _abortSignal!: AbortSignal;
  private _settingsManager: null | PluginSettingsManagerBase<PluginSettings> = null;
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
    await this.settingsManager.loadFromFile();
  }

  /**
   * Adds a lifecycle event listener.
   * If the event has already occurred, the callback will be called immediately.
   *
   * @param name - The name of the event.
   * @param callback - The callback to call when the event is triggered.
   * @returns A {@link Promise} that resolves when the callback is executed.
   */
  public async onLifecycleEvent(name: LifecycleEventName, callback: () => Promisable<unknown>): Promise<void> {
    if (!this.lifecycleEventNames.has(name)) {
      await new Promise<void>((resolve) => {
        this.events.once(name, () => {
          resolve();
        });
      });
    }

    await callback();
  }

  /**
   * Called when the plugin is loaded
   */
  public override async onload(): Promise<void> {
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
    await this.onloadComplete();
    await this.triggerLifecycleEvent('loadComplete');
    setTimeout(() => {
      this.app.workspace.onLayoutReady(convertAsyncToSync(async () => {
        await this.onLayoutReady();
        await this.triggerLifecycleEvent('layoutReady');
      }));
    }, 0);
  }

  /**
   * Called when the plugin settings are loaded or reloaded.
   *
   * @param _settings - The settings.
   * @returns A {@link Promise} or `void` indicating the completion of the save process
   */
  public onLoadSettings(_settings: PluginSettings): Promisable<void> {
    noop();
  }

  /**
   * Called when the plugin settings are saved.
   *
   * @param _newSettings - The new settings.
   * @param _oldSettings - The old settings.
   * @returns A {@link Promise} or `void` indicating the completion of the save process
   */
  public onSaveSettings(_newSettings: PluginSettings, _oldSettings: PluginSettings): Promisable<void> {
    noop();
  }

  public override onunload(): void {
    invokeAsyncSafely(() => this.triggerLifecycleEvent('unload'));
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
  protected createSettingsManager(): null | PluginSettingsManagerBase<PluginSettings> {
    return null;
  }

  /**
   * Called when the layout is ready. This method can be overridden by subclasses to perform actions once
   * the layout is ready.
   *
   * @returns A {@link Promise} or `void` indicating the completion of the layout setup.
   */
  protected onLayoutReady(): Promisable<void> {
    noop();
  }

  /**
   * Called when the plugin loading is complete. This method must be implemented by subclasses to perform
   * any additional setup required after loading is complete.
   *
   * @returns A {@link Promise} or `void` indicating the completion of the load process.
   */
  protected onloadComplete(): Promisable<void> {
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

  private async triggerLifecycleEvent(name: LifecycleEventName): Promise<void> {
    this.lifecycleEventNames.add(name);
    await this.events.triggerAsync(name);
  }
}
