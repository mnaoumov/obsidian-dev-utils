/**
 * @packageDocumentation PluginId
 * Holder for the plugin ID.
 */

let pluginId = '__no-plugin-id-provided';

/**
 * Returns the plugin ID.
 *
 * @returns The plugin ID.
 */
export function getPluginId(): string {
  return pluginId;
}

/**
 * Sets the plugin ID.
 *
 * @param newPluginId - The new plugin ID.
 */
export function setPluginId(newPluginId: string): void {
  if (newPluginId) {
    pluginId = newPluginId;
  }
}
