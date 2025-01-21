/**
 * @packageDocumentation PluginSettingsBase
 * Base class for plugin settings.
 */

const PRIVATE_PROPERTY_PREFIX = '_';

/**
 * Base class for plugin settings.
 */
export abstract class PluginSettingsBase {
  /**
   * Determines if the settings should be saved after loading.
   *
   * @returns A boolean indicating whether the settings should be saved after loading.
   */
  public get shouldSaveAfterLoad(): boolean {
    return this._shouldSaveAfterLoad;
  }

  private _shouldSaveAfterLoad = false;

  /**
   * Initializes the settings from JSON data.
   *
   * @param data - The data to initialize the settings from.
   */
  public init(data: unknown): void {
    if (data === undefined || data === null) {
      return;
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      const type = Array.isArray(data) ? 'Array' : typeof data;
      console.error(`Invalid data type. Expected Object, got: ${type}`);
      return;
    }

    this.initFromRecord(data as Record<string, unknown>);
  }

  /**
   * Converts the settings to a JSON object.
   *
   * @returns The settings as a JSON object.
   */
  public toJSON(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this).filter(([key]) => !key.startsWith(PRIVATE_PROPERTY_PREFIX)));
  }

  protected initFromRecord(record: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith(PRIVATE_PROPERTY_PREFIX)) {
        continue;
      }
      if (key in this) {
        this[key as keyof this] = value as this[keyof this];
      } else {
        console.error(`Unknown property: ${key}`);
      }
    }
  }
}
