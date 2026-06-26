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
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Registers a status bar item.
   */
  public addStatusBarItem(): HTMLElement {
    return this.plugin.addStatusBarItem();
  }
}
