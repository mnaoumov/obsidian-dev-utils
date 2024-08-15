import {
  Notice,
  Plugin
} from "obsidian";

export async function showErrorAndDisablePlugin(plugin: Plugin, message: string): Promise<void> {
  new Notice(message);
  console.error(message);
  await plugin.app.plugins.disablePlugin(plugin.manifest.id);
}

export async function reloadPlugin(plugin: Plugin): Promise<void> {
  const plugins = plugin.app.plugins;
  const pluginId = plugin.manifest.id;
  await plugins.disablePlugin(pluginId);
  await plugins.enablePlugin(pluginId);
}
