/**
 * @file
 *
 * Ribbon icon registrars.
 */

import type { IconName } from 'obsidian';

import { Plugin } from 'obsidian';

/**
 * Ribbon icon registrar.
 */
export interface RibbonIconRegistrar {
  /**
   * Registers a ribbon icon.
   *
   * @param params - The parameters for the ribbon icon registration.
   * @returns The HTML element representing the registered ribbon icon.
   */
  addRibbonIcon(params: RibbonIconRegistrarAddRibbonIconParams): HTMLElement;
}

/**
 * Parameters for registering a ribbon icon.
 */
export interface RibbonIconRegistrarAddRibbonIconParams {
  /**
   * Callback function for the ribbon icon to register.
   *
   * @param evt - The mouse event that triggered the callback.
   */
  callback(this: void, evt: MouseEvent): void;

  /**
   * The icon name for the ribbon icon to register.
   */
  readonly icon: IconName;

  /**
   * The title for the ribbon icon to register.
   */
  readonly title: string;
}

type PluginRibbonIconRegistrarAddRibbonIconParams = RibbonIconRegistrarAddRibbonIconParams;

/**
 * Ribbon icon registrar in an Obsidian plugin.
 */
export class PluginRibbonIconRegistrar implements RibbonIconRegistrar {
  /**
   * Creates a new instance of the {@link PluginRibbonIconRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Registers a ribbon icon.
   *
   * @param params - The parameters for the ribbon icon registration.
   * @returns The HTML element representing the registered ribbon icon.
   */
  public addRibbonIcon(params: PluginRibbonIconRegistrarAddRibbonIconParams): HTMLElement {
    return this.plugin.addRibbonIcon(params.icon, params.title, params.callback);
  }
}
