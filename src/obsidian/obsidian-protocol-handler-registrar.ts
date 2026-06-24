/**
 * @file
 *
 * Obsidian protocol handler registrars.
 */

import type {
  ObsidianProtocolData,
  Plugin
} from 'obsidian';

/**
 * A registrar for Obsidian protocol handlers.
 */
export interface ObsidianProtocolHandlerRegistrar {
  /**
   * Registers an Obsidian protocol handler.
   *
   * @param params - The parameters for the Obsidian protocol handler registration.
   */
  registerObsidianProtocolHandler(params: ObsidianProtocolHandlerRegistrarRegisterObsidianProtocolHandlerParams): void;
}

interface ObsidianProtocolHandlerRegistrarRegisterObsidianProtocolHandlerParams {
  /**
   * The action to register the handler for.
   */
  readonly action: string;

  /**
   * The handler to register.
   *
   * @param obsidianProtocolData - The data passed to the handler.
   * @returns The result of the handler.
   */
  handler(this: void, obsidianProtocolData: ObsidianProtocolData): unknown;
}

type PluginObsidianProtocolHandlerRegistrarRegisterObsidianProtocolHandlerParams = ObsidianProtocolHandlerRegistrarRegisterObsidianProtocolHandlerParams;

/**
 * Obsidian protocol handler registrar in an Obsidian plugin.
 */
export class PluginObsidianProtocolHandlerRegistrar implements ObsidianProtocolHandlerRegistrar {
  private readonly plugin: Plugin;

  /**
   * Creates a new instance of the {@link PluginObsidianProtocolHandlerRegistrar} class.
   *
   * @param plugin - The plugin to register the protocol handler with.
   */
  public constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Registers an Obsidian protocol handler.
   *
   * @param params - The parameters for the Obsidian protocol handler registration.
   */
  public registerObsidianProtocolHandler(params: PluginObsidianProtocolHandlerRegistrarRegisterObsidianProtocolHandlerParams): void {
    this.plugin.registerObsidianProtocolHandler(params.action, params.handler);
  }
}
