/**
 * @file
 *
 * Extensions registrars.
 */

import { Plugin } from 'obsidian';

/**
 * Extensions registrar.
 */
export interface ExtensionsRegistrar {
  /**
   * Registers extensions.
   *
   * @param params - The parameters for the extensions registration.
   */
  registerExtensions(params: ExtensionsRegistrarRegisterExtensionsParams): void;
}

/**
 * Parameters for registering extensions.
 */
export interface ExtensionsRegistrarRegisterExtensionsParams {
  /**
   * The extensions to register.
   */
  readonly extensions: string[];

  /**
   * The view type to register the extensions for.
   */
  readonly viewType: string;
}

type PluginExtensionsRegistrarRegisterExtensionsParams = ExtensionsRegistrarRegisterExtensionsParams;

/**
 * Extensions registrar in an Obsidian plugin.
 */
export class PluginExtensionsRegistrar implements ExtensionsRegistrar {
  /**
   * Creates a new instance of the {@link PluginExtensionsRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Registers extensions.
   *
   * @param params - The parameters for the extensions registration.
   */
  public registerExtensions(params: PluginExtensionsRegistrarRegisterExtensionsParams): void {
    this.plugin.registerExtensions(params.extensions, params.viewType);
  }
}
