/**
 * @file
 *
 * Handles the "Open settings" command.
 */

import type { PluginSettingsTabBase } from '../plugin/plugin-settings-tab.ts';

import { GlobalCommandHandler } from './global-command-handler.ts';

/**
 * A command handler that opens the settings tab for a plugin.
 */
export class OpenSettingsCommandHandler extends GlobalCommandHandler {
  /**
   * Constructs a new instance.
   *
   * @param pluginName - The name of the plugin.
   * @param settingsTab - The settings tab to open.
   */
  public constructor(pluginName: string, private readonly settingsTab: PluginSettingsTabBase<object>) {
    super({
      icon: 'settings',
      id: 'open-settings',
      name: 'Open settings',
      pluginName
    });
  }

  /**
   * Executes the command.
   */
  public override execute(): void {
    this.settingsTab.show();
  }
}
