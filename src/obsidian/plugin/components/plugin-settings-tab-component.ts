/**
 * @file
 *
 * Component that registers a plugin settings tab with Obsidian.
 * Also registers an "Open Settings" command automatically.
 */

import type { Plugin } from 'obsidian';

import { Component } from 'obsidian';

import type { PluginSettingsTabBase } from '../plugin-settings-tab.ts';

import { CommandHandlerComponent } from '../../command-handlers/command-handler-component.ts';
import { OpenSettingsCommandHandler } from '../../command-handlers/open-settings-command-handler.ts';

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
    this.addChild(new CommandHandlerComponent(this.plugin, new OpenSettingsCommandHandler(this.plugin.manifest.name, this.settingsTab)));
  }
}
