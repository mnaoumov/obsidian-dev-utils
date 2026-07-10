/**
 * @file
 *
 * Status bar item registrars.
 */

import { Plugin } from 'obsidian';

/**
 * Status bar item registrar.
 */
export interface StatusBarItemRegistrar {
  /**
   * Registers a status bar item.
   *
   * @returns The registered status bar item element.
   */
  addStatusBarItem(): HTMLElement;
}

/**
 * Status bar item registrar in an Obsidian plugin.
 */
export class PluginStatusBarItemRegistrar implements StatusBarItemRegistrar {
  /**
   * Creates a new instance of the {@link PluginStatusBarItemRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(protected readonly plugin: Plugin) {}

  /**
   * Registers a status bar item.
   *
   * @returns The registered status bar item element.
   */
  public addStatusBarItem(): HTMLElement {
    return this.plugin.addStatusBarItem();
  }
}
