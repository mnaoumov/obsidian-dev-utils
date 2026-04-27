/**
 * @file
 *
 * A module for handling data loading and saving to the plugin's data file.
 */

import type { Plugin } from 'obsidian';

/**
 * A handler for loading and saving data to the plugin's data file.
 */
export interface DataHandler {
  /**
   * A function to load data from the plugin's data file.
   *
   * @returns The loaded data.
   */
  loadData(): Promise<unknown>;

  /**
   * A function to save data to the plugin's data file.
   *
   * @param data - The data to save.
   */
  saveData(data: unknown): Promise<void>;
}

/**
 * A handler for loading and saving data to the plugin's data file.
 */
export class PluginDataHandler implements DataHandler {
  /**
   * Creates a new plugin data handler.
   *
   * @param plugin - The plugin instance.
   */
  public constructor(private readonly plugin: Plugin) {
  }

  /**
   * Loads data from the plugin's data file.
   *
   * @returns The loaded data.
   */
  public async loadData(): Promise<unknown> {
    return this.plugin.loadData();
  }

  /**
   * Saves data to the plugin's data file.
   *
   * @param data - The data to save.
   * @returns A promise that resolves when the data is saved.
   */
  public async saveData(data: unknown): Promise<void> {
    return this.plugin.saveData(data);
  }
}
