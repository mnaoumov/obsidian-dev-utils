export function loadPluginSettings<PluginSettings extends object>(defaultPluginSettingsFactory: () => PluginSettings, data: unknown): PluginSettings {
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

export function clonePluginSettings<PluginSettings extends object>(defaultPluginSettingsFactory: () => PluginSettings, settings: PluginSettings): PluginSettings {
  return loadPluginSettings(defaultPluginSettingsFactory, settings);
}
