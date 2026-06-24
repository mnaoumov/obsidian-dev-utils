/**
 * @file
 *
 * Bases views registrars.
 */

import type { BasesViewRegistration } from 'obsidian';

import { Plugin } from 'obsidian';

/**
 * Bases views registrar.
 */
export interface BasesViewRegistrar {
  /**
   * Registers a bases view.
   *
   * @param params - The parameters for the bases view registration.
   */
  registerBasesView(params: BasesViewRegistrarRegisterBasesViewParams): void;
}

/**
 * Parameters for registering a bases view.
 */
export interface BasesViewRegistrarRegisterBasesViewParams {
  /**
   * The registration details for the view.
   */
  readonly registration: BasesViewRegistration;

  /**
   * The ID of the view to register.
   */
  readonly viewId: string;
}

type PluginBasesViewRegistrarRegisterBasesViewParams = BasesViewRegistrarRegisterBasesViewParams;

/**
 * Bases views registrar in an Obsidian plugin.
 */
export class PluginBasesViewRegistrar implements BasesViewRegistrar {
  /**
   * Creates a new instance of the {@link PluginBasesViewRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Registers a bases view
   *
   * @param params - The parameters for the bases view registration.
   */
  public registerBasesView(params: PluginBasesViewRegistrarRegisterBasesViewParams): void {
    this.plugin.registerBasesView(params.viewId, params.registration);
  }
}
