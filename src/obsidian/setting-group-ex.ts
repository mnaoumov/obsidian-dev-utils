/**
 * @file
 *
 * Extends the SettingGroup class with additional methods for adding settings.
 */

import { SettingGroup } from 'obsidian';

import { SettingEx } from './setting-ex.ts';

/**
 * An extended setting group that allows you to add extended settings to the setting group.
 */
export class SettingGroupEx extends SettingGroup {
  /**
   * Creates a new setting group.
   *
   * @param containerElement - The container element.
   */
  public constructor(containerElement: HTMLElement) {
    super(containerElement);
  }

  /**
   * Adds a extended setting to the setting group.
   *
   * @param callback - The callback to add the setting.
   * @returns The setting group.
   */
  public addSettingEx(callback: (setting: SettingEx) => void): this {
    const setting = new SettingEx(this.listEl);
    callback(setting);
    return this;
  }
}
