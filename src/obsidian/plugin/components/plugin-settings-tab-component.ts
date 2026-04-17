/**
 * @file
 *
 * Component that registers a plugin settings tab with Obsidian.
 * Also registers an "Open Settings" command automatically.
 */

import type { Plugin } from 'obsidian';

import { Component } from 'obsidian';

import type { PluginSettingsTabBase } from '../plugin-settings-tab.ts';

/**
 * Wraps a {@link PluginSettingsTabBase} and registers it with Obsidian on load.
 * Also registers an "Open Settings" command to open the settings tab from the command palette.
 */
export class PluginSettingsTabComponent extends Component {
  /**
   * Creates a new plugin settings tab component.
   *
   * @param plugin - The Obsidian plugin instance.
   * @param settingsTab - The settings tab to register.
   */
  public constructor(
    private readonly plugin: Plugin,
    public readonly settingsTab: PluginSettingsTabBase<object>
  ) {
    super();
  }

  /**
   * Registers the settings tab and an "Open Settings" command with Obsidian.
   */
  public override onload(): void {
    this.plugin.addSettingTab(this.settingsTab);
    this.plugin.addCommand({
      callback: () => {
        this.plugin.app.setting.openTabById(this.plugin.manifest.id);
        this.plugin.app.setting.open();
      },
      icon: 'settings',
      id: 'open-settings',
      name: 'Open settings'
    });
  }
}
