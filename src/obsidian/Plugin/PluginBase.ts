/**
 * @packageDocumentation PluginBase
 * Base class for Obsidian plugins providing utility methods for settings management, error handling, and notifications.
 *
 * This class simplifies the process of managing plugin settings, displaying notifications, and handling errors.
 * Subclasses should implement methods to create default settings and settings tabs, and complete plugin-specific
 * loading tasks.
 */

import type { PluginManifest } from 'obsidian';

import debug from 'debug';
import {
  App,
  Notice,
  Plugin,
  PluginSettingTab
} from 'obsidian';

import type { MaybePromise } from '../../Async.ts';
import type { EmptySettings } from './EmptySettings.ts';
import type { PluginSettingsBase } from './PluginSettingsBase.ts';

import { registerAsyncErrorEventHandler } from '../../Error.ts';
import { noop } from '../../Function.ts';

/**
 * Base class for creating Obsidian plugins with built-in support for settings management, error handling, and notifications.
 *
 * @typeParam PluginSettings - The type representing the plugin settings object.
 */
export abstract class PluginBase<PluginSettings extends PluginSettingsBase = EmptySettings> extends Plugin {
  /**
   * Use instead of `console.debug()` to log messages.
   *
   * Those messages are not shown by default, but can be shown by setting the `DEBUG` environment variable to the plugin ID.
   *
   * @see {@link https://github.com/debug-js/debug?tab=readme-ov-file#browser-support}
   *
   * @param message - The message to log.
   * @param args - The arguments to log.
   */
  public readonly consoleDebug: (message: string, ...args: unknown[]) => void;

  /**
   * Gets the AbortSignal used for aborting long-running operations.
   *
   * @returns The abort signal.
   */
  public get abortSignal(): AbortSignal {
    return this._abortSignal;
  }

  /**
   * Gets a copy of the current plugin settings.
   *
   * @returns A copy of the plugin settings.
   */
  public get settingsCopy(): PluginSettings {
    return this.createPluginSettings(this.settings.toJSON());
  }

  /**
   * Gets the plugin settings.
   *
   * @returns The plugin settings.
   */
  protected get settings(): PluginSettings {
    return this._settings;
  }

  private _abortSignal!: AbortSignal;

  private _settings!: PluginSettings;

  private notice?: Notice;

  /**
   * Constructs a new PluginBase instance.
   *
   * @param app - The Obsidian app instance.
   * @param manifest - The plugin manifest.
   */
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    const consoleDebugInstance = debug.default(manifest.id);
    this.consoleDebug = (message: string, ...args: unknown[]): void => void consoleDebugInstance(message, ...args);
    consoleDebugInstance(`Debug messages for plugin '${manifest.name}' are not shown by default. Set localStorage.debug='${manifest.id}' to see them. See https://github.com/debug-js/debug?tab=readme-ov-file#browser-support for more information`);
  }

  /**
   * Called when the plugin is loaded
   */
  public override async onload(): Promise<void> {
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
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
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
  protected onLayoutReady(): MaybePromise<void> {
    noop();
  }

  /**
   * Called when the plugin loading is complete. This method must be implemented by subclasses to perform
   * any additional setup required after loading is complete.
   *
   * @returns A promise or void indicating the completion of the load process.
   */
  protected onloadComplete(): MaybePromise<void> {
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
    if (this._settings.shouldSaveAfterLoad()) {
      await this.saveSettings(this._settings);
    }
  }
}
