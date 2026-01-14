/**
 * @packageDocumentation
 *
 * Extends the SettingGroup class with additional methods for adding settings.
 */

import { SettingGroup } from 'obsidian';

import { SettingEx } from './SettingEx.ts';

/**
 * An extended setting group that allows you to add extended settings to the setting group.
 */
export class SettingGroupEx extends SettingGroup {
  /**
   * Creates a new setting group.
   *
   * @param containerEl - The container element.
   */
  public constructor(containerEl: HTMLElement) {
    super(containerEl);
  }

  /**
   * Adds a extended setting to the setting group.
   *
   * @param cb - The callback to add the setting.
   * @returns The setting group.
   */
  public addSettingEx(cb: (setting: SettingEx) => void): this {
    const setting = new SettingEx(this.listEl);
    cb(setting);
    return this;
  }
}
