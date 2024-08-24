/**
 * @packageDocumentation PluginSettings
 * This module provides functions for loading and cloning plugin settings.
 * It includes utilities for merging user settings with default settings and creating copies of settings.
 */

/**
 * Loads plugin settings by merging provided data with default settings.
 *
 * @typeParam PluginSettings - The type of plugin settings object.
 * @param defaultPluginSettingsFactory - A factory function that returns the default settings.
 * @param data - The data to merge with the default settings.
 * @returns {PluginSettings} The merged settings object.
 */
export function loadPluginSettings<PluginSettings extends object>(
  defaultPluginSettingsFactory: () => PluginSettings,
  data: unknown
): PluginSettings {
  const defaultPluginSettings = defaultPluginSettingsFactory();

  type PluginSettingsKeys = keyof PluginSettings;
  type PluginSettingsValues = PluginSettings[PluginSettingsKeys];

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key in defaultPluginSettings) {
        defaultPluginSettings[key as PluginSettingsKeys] = value as PluginSettingsValues;
      }
    }
  }

  return defaultPluginSettings;
}

/**
 * Clones plugin settings by loading them from the given settings object and default settings factory.
 *
 * @typeParam PluginSettings - The type of plugin settings object.
 * @param defaultPluginSettingsFactory - A factory function that returns the default settings.
 * @param settings - The settings to clone.
 * @returns {PluginSettings} A new settings object that is a clone of the provided settings.
 */
export function clonePluginSettings<PluginSettings extends object>(
  defaultPluginSettingsFactory: () => PluginSettings,
  settings: PluginSettings
): PluginSettings {
  return loadPluginSettings(defaultPluginSettingsFactory, settings);
}
