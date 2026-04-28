/**
 * @file
 *
 * Registers an Obsidian protocol handler.
 */

import type {
  ObsidianProtocolHandler,
  Plugin
} from 'obsidian';

/**
 * A registrar for Obsidian protocol handlers.
 */
export interface ObsidianProtocolHandlerRegistrar {
  /**
   * Registers an Obsidian protocol handler.
   *
   * @param action - The action to register the handler for.
   * @param handler - The handler to register.
   */
  registerObsidianProtocolHandler(action: string, handler: ObsidianProtocolHandler): void;
}

/**
 * A registrar for Obsidian protocol handlers.
 */
export class PluginObsidianProtocolHandlerRegistrar implements ObsidianProtocolHandlerRegistrar {
  private readonly plugin: Plugin;

  /**
   * Creates a new Obsidian protocol handler registrar.
   *
   * @param plugin - The plugin to register the protocol handler with.
   */
  public constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Registers an Obsidian protocol handler.
   *
   * @param action - The action to register the handler for.
   * @param handler - The handler to register.
   */
  public registerObsidianProtocolHandler(action: string, handler: ObsidianProtocolHandler): void {
    this.plugin.registerObsidianProtocolHandler(action, handler);
  }
}
