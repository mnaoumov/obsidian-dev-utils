/**
 * @file
 *
 * Registrar for commands.
 */

import type {
  Command,
  Plugin
} from 'obsidian';

/**
 * A registrar for commands.
 */
export interface CommandRegistrar {
  addCommand(command: Command): void;
}

/**
 * A command registrar that adds commands to a plugin.
 */
export class PluginCommandRegistrar implements CommandRegistrar {
  /**
   * Creates a new plugin command registrar.
   *
   * @param plugin - The plugin to add commands to.
   */
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Adds a command to the plugin.
   *
   * @param command - The command to add.
   */
  public addCommand(command: Command): void {
    this.plugin.addCommand(command);
  }
}
