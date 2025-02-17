/**
 * @packageDocumentation Plugin
 * This module provides utility functions for managing Obsidian plugins,
 * including displaying error messages, disabling plugins, and reloading them.
 */

import type { Plugin } from 'obsidian';

import { Notice } from 'obsidian';

import { printError } from '../../Error.ts';

/**
 * Reloads the specified plugin by disabling and then re-enabling it.
 *
 * @param plugin - The plugin to reload.
 * @returns A promise that resolves when the plugin is reloaded.
 */
export async function reloadPlugin(plugin: Plugin): Promise<void> {
  const plugins = plugin.app.plugins;
  const pluginId = plugin.manifest.id;
  await plugins.disablePlugin(pluginId);
  await plugins.enablePlugin(pluginId);
}

/**
 * Displays an error message as a notice, logs it to the console, and disables the specified plugin.
 *
 * @param plugin - The plugin to disable.
 * @param message - The error message to display and log.
 * @returns A promise that resolves when the plugin is disabled.
 */
export async function showErrorAndDisablePlugin(plugin: Plugin, message: string): Promise<void> {
  new Notice(message);
  printError(new Error(message));
  await plugin.app.plugins.disablePlugin(plugin.manifest.id);
}
