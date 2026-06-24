/**
 * @file
 *
 * Hover link source registrars.
 */

import type { HoverLinkSource } from 'obsidian';

import { Plugin } from 'obsidian';

/**
 * Hover link source registrar.
 */
export interface HoverLinkSourceRegistrar {
  /**
   * Registers a hover link source.
   *
   * @param params - The parameters for the hover link source registration.
   */
  registerHoverLinkSource(params: HoverLinkSourceRegistrarRegisterHoverLinkSourceParams): void;
}

/**
 * Parameters for registering a hover link source.
 */
export interface HoverLinkSourceRegistrarRegisterHoverLinkSourceParams {
  /**
   * The ID of the hover link source to register.
   */
  readonly id: string;

  /**
   * The information about the hover link source to register.
   */
  readonly info: HoverLinkSource;
}

type PluginHoverLinkSourceRegistrarRegisterHoverLinkSourceParams = HoverLinkSourceRegistrarRegisterHoverLinkSourceParams;

/**
 * Hover link source registrar in an Obsidian plugin.
 */
export class PluginHoverLinkSourceRegistrar implements HoverLinkSourceRegistrar {
  /**
   * Creates a new instance of the {@link PluginHoverLinkSourceRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Registers a hover link source.
   *
   * @param params - The parameters for the hover link source registration.
   */
  public registerHoverLinkSource(params: PluginHoverLinkSourceRegistrarRegisterHoverLinkSourceParams): void {
    this.plugin.registerHoverLinkSource(params.id, params.info);
  }
}
