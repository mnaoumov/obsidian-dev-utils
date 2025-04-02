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

import type { EmptySettings } from './EmptySettings.ts';
import type { PluginSettingsBase } from './PluginSettingsBase.ts';

import { getDebugger } from '../../Debug.ts';
import { registerAsyncErrorEventHandler } from '../../Error.ts';
import { noop } from '../../Function.ts';
import { initPluginContext } from './PluginContext.ts';

/**
 * Base class for creating Obsidian plugins with built-in support for settings management, error handling, and notifications.
 *
 * @typeParam PluginSettings - The type representing the plugin settings object.
 */
export abstract class PluginBase<PluginSettings extends PluginSettingsBase = EmptySettings> extends Plugin {
  private _abortSignal!: AbortSignal;
  private _settings!: PluginSettings;
  private notice?: Notice;

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
    return this._settings as ReadonlyDeep<PluginSettings>;
  }

  /**
   * Gets a writable copy of the plugin settings.
   *
   * @returns A writable copy of the plugin settings.
   */
  public get settingsClone(): PluginSettings {
    return this.createPluginSettings(this.settings.toJSON());
  }

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
    await this.loadSettings();
  }

  /**
   * Called when the plugin is loaded
   */
  public override async onload(): Promise<void> {
    initPluginContext(this.app, this.manifest.id);

    this.register(registerAsyncErrorEventHandler(() => {
      this.showNotice('An unhandled error occurred. Please check the console for more information.');
    }));

    await this.loadSettings();
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
   * Saves the new plugin settings.
   *
   * @param newSettings - The new settings to save.
   * @returns A promise that resolves when the settings are saved.
   */
  public async saveSettings(newSettings: PluginSettings): Promise<void> {
    const json = newSettings.toJSON();
    this._settings = this.createPluginSettings(json);
    await this.saveData(json);
  }

  /**
   * Creates the plugin settings. This method must be implemented by subclasses.
   *
   * @param data - The data to create the plugin settings from.
   * @returns The plugin settings.
   */
  protected abstract createPluginSettings(data: unknown): PluginSettings;

  /**
   * Creates a plugin settings tab. This method must be implemented by subclasses.
   *
   * @returns The settings tab or null if not applicable.
   */
  protected abstract createPluginSettingsTab(): null | PluginSettingTab;

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

  /**
   * Loads the plugin settings from the saved data.
   *
   * @returns A promise that resolves when the settings are loaded.
   */
  private async loadSettings(): Promise<void> {
    const data = await this.loadData() as unknown;
    this._settings = this.createPluginSettings(data);
    if (this.settings.shouldSaveAfterLoad) {
      await this.saveSettings(this._settings);
    }
  }
}
