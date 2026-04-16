/**
 * @file
 *
 * Component that registers a plugin settings tab with Obsidian.
 */

import type { Plugin } from 'obsidian';

import { Component } from 'obsidian';

import type { PluginSettingsTabBase } from '../plugin-settings-tab-base.ts';

/**
 * Wraps a {@link PluginSettingsTabBase} and registers it with Obsidian on load.
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
   * Registers the settings tab with Obsidian.
   */
  public override onload(): void {
    this.plugin.addSettingTab(this.settingsTab);
  }
}
