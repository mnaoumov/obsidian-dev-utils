/**
 * @file
 *
 * Component that registers a plugin settings tab with Obsidian.
 * Also registers an "Open Settings" command automatically.
 */

import type { Plugin } from 'obsidian';

import { Component } from 'obsidian';

import type { ActiveFileProvider } from '../../active-file-provider.ts';
import type { CommandRegistrar } from '../../command-registrar.ts';
import type { MenuEventRegistrar } from '../../menu-event-registrar.ts';
import type { PluginSettingsTabBase } from '../plugin-settings-tab.ts';

import { CommandHandlerComponent } from '../../command-handlers/command-handler-component.ts';
import { OpenSettingsCommandHandler } from '../../command-handlers/open-settings-command-handler.ts';

interface PluginSettingsTabComponentConstructorParams {
  readonly activeFileProvider: ActiveFileProvider;
  readonly commandRegistrar: CommandRegistrar;
  readonly menuEventRegistrar: MenuEventRegistrar;
  readonly plugin: Plugin;
  readonly pluginSettingsTab: PluginSettingsTabBase<object>;
}

/**
 * Wraps a {@link PluginSettingsTabBase} and registers it with Obsidian on load.
 * Also registers an "Open Settings" command to open the settings tab from the command palette.
 */
export class PluginSettingsTabComponent extends Component {
  private readonly activeFileProvider: ActiveFileProvider;
  private readonly commandRegistrar: CommandRegistrar;
  private readonly menuEventRegistrar: MenuEventRegistrar;
  private readonly plugin: Plugin;
  private readonly pluginSettingsTab: PluginSettingsTabBase<object>;

  /**
   * Creates a new plugin settings tab component.
   *
   * @param params - The plugin settings tab component constructor parameters.
   */
  public constructor(params: PluginSettingsTabComponentConstructorParams) {
    super();
    this.plugin = params.plugin;
    this.pluginSettingsTab = params.pluginSettingsTab;
    this.activeFileProvider = params.activeFileProvider;
    this.menuEventRegistrar = params.menuEventRegistrar;
    this.commandRegistrar = params.commandRegistrar;
  }

  /**
   * Registers the settings tab and an "Open Settings" command with Obsidian.
   */
  public override onload(): void {
    this.plugin.addSettingTab(this.pluginSettingsTab);
    this.addChild(
      new CommandHandlerComponent({
        activeFileProvider: this.activeFileProvider,
        commandHandler: new OpenSettingsCommandHandler({
          pluginName: this.plugin.manifest.name,
          pluginSettingsTab: this.pluginSettingsTab
        }),
        commandRegistrar: this.commandRegistrar,
        menuEventRegistrar: this.menuEventRegistrar
      })
    );
  }
}
