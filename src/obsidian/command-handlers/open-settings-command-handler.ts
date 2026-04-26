/**
 * @file
 *
 * Handles the "Open settings" command.
 */

import type { PluginSettingsTabBase } from '../plugin/plugin-settings-tab.ts';

import { GlobalCommandHandler } from './global-command-handler.ts';

interface OpenSettingsCommandHandlerConstructorParams {
  readonly pluginName: string;
  readonly pluginSettingsTab: PluginSettingsTabBase<object>;
}

/**
 * A command handler that opens the settings tab for a plugin.
 */
export class OpenSettingsCommandHandler extends GlobalCommandHandler {
  private readonly pluginSettingsTab: PluginSettingsTabBase<object>;

  /**
   * Constructs a new instance.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: OpenSettingsCommandHandlerConstructorParams) {
    super({
      icon: 'settings',
      id: 'open-settings',
      name: 'Open settings',
      pluginName: params.pluginName
    });
    this.pluginSettingsTab = params.pluginSettingsTab;
  }

  /**
   * Executes the command.
   */
  public override execute(): void {
    this.pluginSettingsTab.show();
  }
}
