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
  /**
   * Adds a command to the registrar.
   *
   * @param command - The command to add.
   */
  addCommand(command: Command): void;

  /**
   * Removes a command from the registrar.
   *
   * @param commandId - The ID of the command to remove.
   */
  removeCommand(commandId: string): void;
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

  /**
   * Removes a command from the plugin.
   *
   * @param commandId - The ID of the command to remove.
   */
  public removeCommand(commandId: string): void {
    this.plugin.removeCommand(commandId);
  }
}
