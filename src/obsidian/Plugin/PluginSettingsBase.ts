import { type Constructor } from "../../Type.ts";

export class PluginSettingsBase {
  public static load<PluginSettings extends PluginSettingsBase>(constructor: Constructor<PluginSettings>, data: unknown): PluginSettings {
    const target = new constructor();

    type PluginSettingsKeys = keyof PluginSettings;
    type PluginSettingsValues = PluginSettings[PluginSettingsKeys];

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (key in target) {
          target[key as PluginSettingsKeys] = value as PluginSettingsValues;
        }
      }
    }

    return target;
  }

  public static clone<PluginSettings extends PluginSettingsBase>(settings: PluginSettings): PluginSettings {
    return this.load(settings.constructor as Constructor<PluginSettings>, settings);
  }
}
