/**
 * @packageDocumentation PluginSettingsBase
 * Base class for plugin settings.
 */

/**
 * Type representing the constructor for plugin settings.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
export type PluginSettingsConstructor<PluginSettings extends PluginSettingsBase> = new (data: unknown) => PluginSettings;

/**
 * Base class for plugin settings.
 */
export class PluginSettingsBase {
  /**
   * Constructor for PluginSettingsBase.
   *
   * @param data - The data to initialize the settings from.
   */
  public constructor(data: unknown) {
    this.initFromJson(data);
  }

  /**
   * Clones the settings.
   *
   * @returns A clone of the settings.
   */
  public clone(): this {
    return new (this.constructor as PluginSettingsConstructor<this>)(this.toJSON());
  }

  /**
   * Initializes the settings from JSON data.
   *
   * @param data - The data to initialize the settings from.
   */
  public initFromJson(data: unknown): void {
    if (data === undefined || data === null) {
      return;
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      const type = Array.isArray(data) ? 'Array' : typeof data;
      console.error(`Invalid data type. Expected Object, got: ${type}`);
      return;
    }

    const record = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key in this) {
        this[key as keyof this] = value as this[keyof this];
      } else {
        console.error(`Unknown property: ${key}`);
      }
    }
  }

  /**
   * Determines if the settings should be saved after loading.
   *
   * @returns A boolean indicating whether the settings should be saved after loading.
   */
  public shouldSaveAfterLoad(): boolean {
    return false;
  }

  /**
   * Converts the settings to a JSON object.
   *
   * @returns The settings as a JSON object.
   */
  public toJSON(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this));
  }
}
