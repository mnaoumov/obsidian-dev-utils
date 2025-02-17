/**
 * @packageDocumentation PluginSettingsBase
 * Base class for plugin settings.
 */

import type { Transformer } from '../../Transformers/Transformer.ts';

import { DateTransformer } from '../../Transformers/DateTransformer.ts';
import { DurationTransformer } from '../../Transformers/DurationTransformer.ts';
import { GroupTransformer } from '../../Transformers/GroupTransformer.ts';
import { SkipPrivatePropertyTransformer } from '../../Transformers/SkipPrivatePropertyTransformer.ts';

const defaultTransformer = new GroupTransformer([
  new SkipPrivatePropertyTransformer(),
  new DateTransformer(),
  new DurationTransformer()
]);

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

  protected _shouldSaveAfterLoad = false;

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
    return this.getTransformer().transformObjectRecursively(this);
  }

  protected getTransformer(): Transformer {
    return defaultTransformer;
  }

  protected initFromRecord(record: Record<string, unknown>): void {
    record = this.getTransformer().transformObjectRecursively(record);
    for (const [key, value] of Object.entries(record)) {
      if (!(key in this)) {
        console.warn(`Unknown property: ${key}`);
        continue;
      }

      this[key as keyof this] = value as this[keyof this];
    }
  }
}
