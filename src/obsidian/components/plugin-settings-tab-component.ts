/**
 * @file
 *
 * Component that registers a plugin settings tab with Obsidian.
 * Also registers an "Open Settings" command automatically.
 */

import type { Plugin } from 'obsidian';

import { PluginSettingTab } from 'obsidian';

import { ComponentEx } from './component-ex.ts';

interface PluginSettingsTabComponentConstructorParams {
  readonly plugin: Plugin;
  readonly pluginSettingsTab: PluginSettingTab;
}

/**
 * Wraps a {@link PluginSettingTab} and registers it with Obsidian on load.
 * Also registers an "Open Settings" command to open the settings tab from the command palette.
 */
export class PluginSettingsTabComponent extends ComponentEx {
  private readonly plugin: Plugin;
  private readonly pluginSettingsTab: PluginSettingTab;

  /**
   * Creates a new plugin settings tab component.
   *
   * @param params - The plugin settings tab component constructor parameters.
   */
  public constructor(params: PluginSettingsTabComponentConstructorParams) {
    super();
    this.plugin = params.plugin;
    this.pluginSettingsTab = params.pluginSettingsTab;
  }

  /**
   * Registers the settings tab and an "Open Settings" command with Obsidian.
   */
  public override onload(): void {
    this.plugin.addSettingTab(this.pluginSettingsTab);
  }
}
