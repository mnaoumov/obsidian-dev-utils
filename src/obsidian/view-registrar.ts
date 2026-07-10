/**
 * @file
 *
 * This file defines the {@link ViewRegistrar} interface and the {@link PluginViewRegistrar} class.
 */

import type {
  View,
  WorkspaceLeaf
} from 'obsidian';

import { Plugin } from 'obsidian';

/**
 * A registrar for views.
 */
export interface ViewRegistrar {
  /**
   * Registers a view type with a view creator.
   *
   * @param params - The parameters for the view registration.
   */
  registerView(params: PluginViewRegistrarRegisterViewParams): void;
}

type PluginViewRegistrarRegisterViewParams = ViewRegistrarRegisterViewParams;

interface ViewRegistrarRegisterViewParams {
  /**
   * The type of the view to register.
   */
  readonly type: string;

  /**
   * The view creator function that creates a view instance for the given type.
   *
   * @param leaf - The workspace leaf where the view will be created.
   * @returns The created view instance.
   */
  viewCreator(this: void, leaf: WorkspaceLeaf): View;
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
  public constructor(protected readonly plugin: Plugin) {
  }

  /**
   * Registers a view type with a view creator.
   *
   * @param params - The parameters for the view registration.
   */
  public registerView(params: PluginViewRegistrarRegisterViewParams): void {
    this.plugin.registerView(params.type, params.viewCreator);
  }
}
