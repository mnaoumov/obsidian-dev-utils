/**
 * @file
 *
 * Handles the "Open settings" command.
 */

import type {
  App,
  SettingTab
} from 'obsidian';

import { GlobalCommandHandler } from './global-command-handler.ts';

/**
 * Constructor parameters for {@link OpenSettingsCommandHandler}.
 */
export interface OpenSettingsCommandHandlerConstructorParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The setting tab to open.
   */
  readonly settingTab: SettingTab;
}

/**
 * A command handler that opens the settings tab for a plugin.
 */
export class OpenSettingsCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly settingTab: SettingTab;

  /**
   * Constructs a new instance.
   *
   * @param params - Constructor parameters.
   */
  public constructor(params: OpenSettingsCommandHandlerConstructorParams) {
    super({
      icon: 'settings',
      id: 'open-settings',
      name: 'Open settings'
    });

    this.app = params.app;
    this.settingTab = params.settingTab;
  }

  /**
   * Executes the command.
   */
  public override execute(): void {
    this.app.setting.open();
    this.app.setting.openTab(this.settingTab);
  }
}
