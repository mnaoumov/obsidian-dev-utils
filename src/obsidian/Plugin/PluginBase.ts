/**
 * @packageDocumentation PluginBase
 * Base class for Obsidian plugins providing utility methods for settings management, error handling, and notifications.
 *
 * This class simplifies the process of managing plugin settings, displaying notifications, and handling errors.
 * Subclasses should implement methods to create default settings and settings tabs, and complete plugin-specific
 * loading tasks.
 */

import {
  Notice,
  Plugin,
  PluginSettingTab
} from "obsidian";
import { registerAsyncErrorEventHandler } from "../../Error.ts";
import {
  loadPluginSettings,
  clonePluginSettings
} from "./PluginSettings.ts";
import type { MaybePromise } from "../../Async.ts";

/**
 * Base class for creating Obsidian plugins with built-in support for settings management, error handling, and notifications.
 *
 * @template PluginSettings - The type representing the plugin settings object.
 */
export abstract class PluginBase<PluginSettings extends object> extends Plugin {
  private _settings!: PluginSettings;
  private notice?: Notice;
  private _abortSignal!: AbortSignal;

  /**
   * Gets the AbortSignal used for aborting asynchronous operations.
   *
   * @returns {AbortSignal} The abort signal.
   */
  protected get abortSignal(): AbortSignal {
    return this._abortSignal;
  }

  /**
   * Gets a copy of the current plugin settings.
   *
   * @returns {PluginSettings} A copy of the plugin settings.
   */
  public get settingsCopy(): PluginSettings {
    return clonePluginSettings(this.createDefaultPluginSettings, this.settings);
  }

  /**
   * Gets the plugin settings.
   *
   * @returns The plugin settings.
   */
  protected get settings(): PluginSettings {
    return this._settings;
  }

  /**
   * Creates the default plugin settings. This method must be implemented by subclasses.
   *
   * @returns {PluginSettings} The default plugin settings.
   */
  protected abstract createDefaultPluginSettings(this: void): PluginSettings;

  /**
   * Creates a plugin settings tab. This method must be implemented by subclasses.
   *
   * @returns {PluginSettingTab | null} The settings tab or null if not applicable.
   */
  protected abstract createPluginSettingsTab(): PluginSettingTab | null;

  /**
   * Called when the plugin is loaded. Handles loading settings, adding a settings tab, registering error handlers,
   * and initializing the plugin.
   *
   * @returns {Promise<void>} A promise that resolves when the plugin is fully loaded.
   */
  public override async onload(): Promise<void> {
    await this.loadSettings();
    const pluginSettingsTab = this.createPluginSettingsTab();
    if (pluginSettingsTab) {
      this.addSettingTab(pluginSettingsTab);
    }
    this.register(registerAsyncErrorEventHandler(() => {
      this.showNotice("An unhandled error occurred. Please check the console for more information.");
    }));

    const abortController = new AbortController();
    this._abortSignal = abortController.signal;
    this.register(() => abortController.abort());
    await this.onloadComplete();
    this.app.workspace.onLayoutReady(() => this.onLayoutReady());
  }

  /**
   * Called when the plugin loading is complete. This method must be implemented by subclasses to perform
   * any additional setup required after loading is complete.
   *
   * @returns {MaybePromise<void>} A promise or void indicating the completion of the load process.
   */
  protected abstract onloadComplete(): MaybePromise<void>;

  /**
   * Called when the layout is ready. This method can be overridden by subclasses to perform actions once
   * the layout is ready.
   */
  protected onLayoutReady(): void { }

  /**
   * Loads the plugin settings from the saved data.
   *
   * @returns {Promise<void>} A promise that resolves when the settings are loaded.
   */
  private async loadSettings(): Promise<void> {
    const data = await this.loadData() as unknown;
    this._settings = await this.parseSettings(data);
  }

  /**
   * Parses the provided settings data and returns the parsed `PluginSettings`.
   *
   * @protected
   * @param {unknown} data - The raw data to be parsed into `PluginSettings`.
   * @returns {MaybePromise<PluginSettings>} A promise that resolves to `PluginSettings` or the settings directly.
   */
  protected parseSettings(data: unknown): MaybePromise<PluginSettings> {
    return loadPluginSettings(this.createDefaultPluginSettings, data);
  }

  /**
   * Saves the new plugin settings.
   *
   * @param {PluginSettings} newSettings - The new settings to save.
   * @returns {Promise<void>} A promise that resolves when the settings are saved.
   */
  public async saveSettings(newSettings: PluginSettings): Promise<void> {
    this._settings = clonePluginSettings(this.createDefaultPluginSettings, newSettings);
    await this.saveData(this.settings);
  }

  /**
   * Displays a notice message to the user.
   *
   * @param {string} message - The message to display.
   */
  protected showNotice(message: string): void {
    if (this.notice) {
      this.notice.hide();
    }

    this.notice = new Notice(`${this.manifest.name}\n${message}`);
  }
}
