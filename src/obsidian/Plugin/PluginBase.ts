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

import { getDebugger } from '../../Debug.ts';
import { registerAsyncErrorEventHandler } from '../../Error.ts';
import {
  noop,
  noopAsync
} from '../../Function.ts';
import { initPluginContext } from './PluginContext.ts';
import { PluginSettingsManagerBase } from './PluginSettingsManagerBase.ts';

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
    setTimeout(() => {
      this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
    }, 0);
  }

  /**
   * Called when the plugin settings are saved.
   *
   * @param _newSettings - The new settings.
   * @param _oldSettings - The old settings.
   * @returns A promise or void indicating the completion of the save process.
   */
  public async onSaveSettings(_newSettings: PluginSettings, _oldSettings: PluginSettings): Promise<void> {
    await noopAsync();
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
   * @returns A promise or void indicating the completion of the layout setup.
   */
  protected onLayoutReady(): Promisable<void> {
    noop();
  }

  /**
   * Called when the plugin loading is complete. This method must be implemented by subclasses to perform
   * any additional setup required after loading is complete.
   *
   * @returns A promise or void indicating the completion of the load process.
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
}
