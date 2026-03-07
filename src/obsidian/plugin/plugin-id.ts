/**
 * @packageDocumentation
 *
 * Holder for the plugin ID.
 */

/**
 * A plugin ID for no plugin.
 */
export const NO_PLUGIN_ID_INITIALIZED = '__no-plugin-id-initialized__';

let pluginId = NO_PLUGIN_ID_INITIALIZED;

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
