/**
 * @file
 *
 * Component that manages displaying notices to the user.
 */

import {
  Component,
  Notice
} from 'obsidian';

/**
 * Manages showing plugin notices. Automatically hides the previous notice when a new one is shown.
 */
export class PluginNoticeComponent extends Component {
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
