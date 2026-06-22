/**
 * @file
 *
 * This file defines the {@link ViewRegistrar} interface and the {@link PluginViewRegistrar} class.
 */

import type { ViewCreator } from 'obsidian';

import { Plugin } from 'obsidian';

/**
 * A registrar for views.
 */
export interface ViewRegistrar {
  /**
   * Registers a view type with a view creator.
   *
   * @param type - The view type to register.
   * @param viewCreator - The view creator function that creates a view instance for the given type.
   */
  registerView(type: string, viewCreator: ViewCreator): void;
}

/**
 * A registrar for views that registers views with a plugin.
 */
export class PluginViewRegistrar implements ViewRegistrar {
  /**
   * Creates a new instance of the {@link PluginViewRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance used to register views.
   */
  public constructor(private readonly plugin: Plugin) {
  }

  /**
   * Registers a view type with a view creator.
   *
   * @param type - The view type to register.
   * @param viewCreator - The view creator function that creates a view instance for the given type.
   */
  public registerView(type: string, viewCreator: ViewCreator): void {
    this.plugin.registerView(type, viewCreator);
  }
}
