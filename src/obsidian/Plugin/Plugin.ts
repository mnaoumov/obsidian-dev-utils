/**
 * @packageDocumentation Plugin
 * This module provides utility functions for managing Obsidian plugins,
 * including displaying error messages, disabling plugins, and reloading them.
 */

import {
  Notice,
  Plugin
} from "obsidian";
import { printError } from "../../Error.ts";

/**
 * Displays an error message as a notice, logs it to the console, and disables the specified plugin.
 *
 * @param {Plugin} plugin - The plugin to disable.
 * @param {string} message - The error message to display and log.
 * @returns {Promise<void>} A promise that resolves when the plugin is disabled.
 */
export async function showErrorAndDisablePlugin(plugin: Plugin, message: string): Promise<void> {
  new Notice(message);
  printError(new Error(message));
  await plugin.app.plugins.disablePlugin(plugin.manifest.id);
}

/**
 * Reloads the specified plugin by disabling and then re-enabling it.
 *
 * @param {Plugin} plugin - The plugin to reload.
 * @returns {Promise<void>} A promise that resolves when the plugin is reloaded.
 */
export async function reloadPlugin(plugin: Plugin): Promise<void> {
  const plugins = plugin.app.plugins;
  const pluginId = plugin.manifest.id;
  await plugins.disablePlugin(pluginId);
  await plugins.enablePlugin(pluginId);
}
