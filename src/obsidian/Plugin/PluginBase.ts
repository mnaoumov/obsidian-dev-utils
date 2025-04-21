/**
 * @packageDocumentation
 *
 * Base class for Obsidian plugins providing utility methods for settings management, error handling, and notifications.
 *
 * This class simplifies the process of managing plugin settings, displaying notifications, and handling errors.
 * Subclasses should implement methods to create default settings and settings tabs, and complete plugin-specific
 * loading tasks.
 */

import type { ReadonlyDeep } from 'type-fest';

import {
  Notice,
  Plugin as ObsidianPlugin
} from 'obsidian';

import type {
  ExtractPluginSettings,
  ExtractPluginSettingsManager,
  ExtractPluginSettingsTab,
  ExtractReadonlyPluginSettingsWrapper,
  PluginTypesBase
} from './PluginTypesBase.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely,
  invokeAsyncSafelyAfterDelay
} from '../../Async.ts';
import { AsyncEvents } from '../../AsyncEvents.ts';
import { getDebugger } from '../../Debug.ts';
import { registerAsyncErrorEventHandler } from '../../Error.ts';
import { noopAsync } from '../../Function.ts';
import { registerAsyncEvent } from '../Components/AsyncEventsComponent.ts';
import { initPluginContext } from './PluginContext.ts';

type LifecycleEventName = 'layoutReady' | 'load' | 'unload';

/**
 * Base class for creating Obsidian plugins with built-in support for settings management, error handling, and notifications.
 *
 * @typeParam PluginTypes - Plugin-specific types.
 */
export abstract class PluginBase<PluginTypes extends PluginTypesBase> extends ObsidianPlugin {
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
  public get settings(): ReadonlyDeep<ExtractPluginSettings<PluginTypes>> {
    return this.settingsManager.settingsWrapper.safeSettings as ReadonlyDeep<ExtractPluginSettings<PluginTypes>>;
  }

  /**
   * Gets the plugin settings manager.
   *
   * @returns The plugin settings manager.
   */
  public get settingsManager(): ExtractPluginSettingsManager<PluginTypes> {
    if (!this._settingsManager) {
      throw new Error('Settings manager not defined');
    }

    return this._settingsManager;
  }

  /**
   * Gets the plugin settings tab.
   *
   * @returns The plugin settings tab.
   */
  public get settingsTab(): ExtractPluginSettingsTab<PluginTypes> {
    if (!this._settingsTab) {
      throw new Error('Settings tab not defined');
    }

    return this._settingsTab;
  }

  private _abortSignal!: AbortSignal;
  private _settingsManager: ExtractPluginSettingsManager<PluginTypes> | null = null;
  private _settingsTab: ExtractPluginSettingsTab<PluginTypes> | null = null;
  private lifecycleEventNames = new Set<LifecycleEventName>();
  private notice?: Notice;

  /**
   * Logs a message to the console.
   *
   * Use instead of `console.debug()`.
   *
   * Those messages are not shown by default, but they can be shown by enabling `your-plugin-id` debugger namespace.
   *
   * @see {@link https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md} for more information.
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
    await this._settingsManager?.loadFromFile(false);
  }

  /**
   * Called when the plugin is loaded
   */
  public override async onload(): Promise<void> {
    await super.onload();
    await this.onloadImpl();
    invokeAsyncSafelyAfterDelay(this.afterLoad.bind(this));
  }

  /** */
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
   * Creates the plugin settings manager. This method must be implemented by subclasses.
   *
   * @returns The plugin settings manager.
   */
  protected createSettingsManager(): ExtractPluginSettingsManager<PluginTypes> | null {
    return null;
  }

  /**
   * Creates a plugin settings tab.
   *
   * @returns The settings tab or null if not applicable.
   */
  protected createSettingsTab(): ExtractPluginSettingsTab<PluginTypes> | null {
    return null;
  }

  /**
   * Called when the layout is ready. This method can be overridden by subclasses to perform actions once
   * the layout is ready.
   */
  protected async onLayoutReady(): Promise<void> {
    await noopAsync();
  }

  /**
   * Executed when the plugin is loaded.
   *
   * This method can be overridden by subclasses to perform actions once the plugin is loaded.
   */
  protected async onloadImpl(): Promise<void> {
    initPluginContext(this.app, this.manifest.id);

    this.register(registerAsyncErrorEventHandler(() => {
      this.showNotice('An unhandled error occurred. Please check the console for more information.');
    }));

    this._settingsManager = this.createSettingsManager();
    if (this._settingsManager) {
      registerAsyncEvent(this, this._settingsManager.on('loadSettings', this.onLoadSettings.bind(this)));
      registerAsyncEvent(this, this._settingsManager.on('saveSettings', this.onSaveSettings.bind(this)));
    }

    await this._settingsManager?.loadFromFile(true);
    this._settingsTab = this.createSettingsTab();
    if (this._settingsTab) {
      this.addSettingTab(this._settingsTab);
    }

    const abortController = new AbortController();
    this._abortSignal = abortController.signal;
    this.register(() => {
      abortController.abort();
    });
  }

  /**
   * Called when the plugin settings are loaded or reloaded.
   *
   * @param _loadedSettings - The loaded settings wrapper.
   * @param _isInitialLoad - Whether the settings are being loaded for the first time.
   */
  protected async onLoadSettings(_loadedSettings: ExtractReadonlyPluginSettingsWrapper<PluginTypes>, _isInitialLoad: boolean): Promise<void> {
    await noopAsync();
  }

  /**
   * Called when the plugin settings are saved.
   *
   * @param _newSettings - The new settings.
   * @param _oldSettings - The old settings.
   * @param _context - The context.
   */
  protected async onSaveSettings(
    _newSettings: ExtractReadonlyPluginSettingsWrapper<PluginTypes>,
    _oldSettings: ExtractReadonlyPluginSettingsWrapper<PluginTypes>,
    _context: unknown
  ): Promise<void> {
    await noopAsync();
  }

  /**
   * Called when the plugin is unloaded.
   */
  protected async onunloadImpl(): Promise<void> {
    await noopAsync();
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
