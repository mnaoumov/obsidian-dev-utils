/**
 * @file
 *
 * Component that manages displaying notices to the user.
 */

import { Notice } from 'obsidian';

import { ComponentEx } from './component-ex.ts';

/**
 * Manages showing plugin notices. Automatically hides the previous notice when a new one is shown.
 */
export class PluginNoticeComponent extends ComponentEx {
  private notice?: Notice;

  /**
   * Creates a new plugin notice component.
   *
   * @param pluginName - The plugin name (shown as prefix in notices).
   */
  public constructor(private readonly pluginName: string) {
    super();
  }

  /**
   * Displays a notice message to the user.
   *
   * @param message - The message to display.
   */
  public showNotice(message: string): void {
    if (this.notice) {
      this.notice.hide();
    }

    this.notice = new Notice(`${this.pluginName}\n${message}`);
  }
}
