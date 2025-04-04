import type { ReadonlyDeep } from 'type-fest';

import { Plugin } from 'obsidian';

import type { StringKeys } from '../../Object.ts';
import type { Transformer } from '../../Transformers/Transformer.ts';

import { noopAsync } from '../../Function.ts';
import { DateTransformer } from '../../Transformers/DateTransformer.ts';
import { DurationTransformer } from '../../Transformers/DurationTransformer.ts';
import { GroupTransformer } from '../../Transformers/GroupTransformer.ts';
import { SkipPrivatePropertyTransformer } from '../../Transformers/SkipPrivatePropertyTransformer.ts';

const defaultTransformer = new GroupTransformer([
  new SkipPrivatePropertyTransformer(),
  new DateTransformer(),
  new DurationTransformer()
]);

class PluginSettingsProperty<PluginSettings extends object, Property extends StringKeys<PluginSettings>> {
  public validationMessage = '';
  private value: PluginSettings[Property] | undefined;

  public constructor(
    private readonly manager: PluginSettingsManagerBase<PluginSettings>,
    private readonly property: Property,
    public readonly defaultValue: PluginSettings[Property]
  ) {}

  public clear(): void {
    this.value = undefined;
    this.validationMessage = '';
  }

  public get(): PluginSettings[Property] {
    return this.value ?? this.defaultValue;
  }

  public getSafe(): PluginSettings[Property] {
    return this.validationMessage ? this.defaultValue : this.get();
  }

  public async set(value: PluginSettings[Property] | undefined): Promise<void> {
    this.value = value;
    if (this.value !== undefined) {
      this.validationMessage = (await this.manager.validate(this.property, this.value) as string | undefined) ?? '';
    }
  }
}

class PropertiesMap<PluginSettings extends object> extends Map<string, PluginSettingsProperty<PluginSettings, StringKeys<PluginSettings>>> {
  public getTyped<Property extends StringKeys<PluginSettings>>(key: Property): PluginSettingsProperty<PluginSettings, Property> {
    const property = super.get(key);
    if (!property) {
      throw new Error(`Property ${String(key)} not found`);
    }

    return property as PluginSettingsProperty<PluginSettings, Property>;
  }

  public setTyped<Property extends StringKeys<PluginSettings>>(key: Property, value: PluginSettingsProperty<PluginSettings, Property>): this {
    return super.set(key, value);
  }
}

/**
 * Base class for managing plugin settings.
 *
 * @typeParam PluginSettings - The type representing the plugin settings object.
 */
export abstract class PluginSettingsManagerBase<PluginSettings extends object> {
  public readonly safeSettings: ReadonlyDeep<PluginSettings>;

  private properties: PropertiesMap<PluginSettings>;

  public constructor(private plugin: Plugin) {
    const defaultSettings = this.createDefaultSettings();
    this.properties = new PropertiesMap<PluginSettings>();

    for (const key of Object.keys(defaultSettings) as StringKeys<PluginSettings>[]) {
      this.properties.set(key, new PluginSettingsProperty(this, key, defaultSettings[key]));
    }

    this.safeSettings = new Proxy(defaultSettings, {
      get: (_target, prop): unknown => {
        if (typeof prop !== 'string') {
          return undefined;
        }

        return this.properties.get(prop);
      }
    }) as ReadonlyDeep<PluginSettings>;
  }

  public getProperty<Property extends StringKeys<PluginSettings>>(property: Property): PluginSettingsProperty<PluginSettings, Property> {
    return this.properties.getTyped(property);
  }

  public async loadFromFile(): Promise<void> {
    for (const property of this.properties.values()) {
      property.clear();
    }

    const data = await this.plugin.loadData() as unknown;

    if (data === undefined || data === null) {
      return;
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      const type = Array.isArray(data) ? 'Array' : typeof data;
      console.error(`Invalid data type. Expected Object, got: ${type}`);
      return;
    }

    let record = data as Record<string, unknown>;
    record = this.getTransformer().transformObjectRecursively(record);
    await this.prepareRecord(record);

    for (const [key, value] of Object.entries(record)) {
      const propertyObj = this.properties.get(key);
      if (!propertyObj) {
        console.warn(`Unknown property: ${key}`);
        continue;
      }

      if (typeof value !== typeof propertyObj.defaultValue) {
        console.warn(`Invalid value type. Expected ${typeof propertyObj.defaultValue}, got: ${typeof value}`);
        continue;
      }

      await propertyObj.set(value as PluginSettings[StringKeys<PluginSettings>]);
    }
  }

  /**
   * Saves the new plugin settings.
   *
   * @returns A promise that resolves when the settings are saved.
   */
  public async saveToFile(): Promise<void> {
    const record = this.getTransformer().transformObjectRecursively(this.getSettings());
    await this.plugin.saveData(record);
  }

  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  public async validate<Property extends StringKeys<PluginSettings>>(_property: Property, _value: PluginSettings[Property]): Promise<string | void> {
    await noopAsync();
  }

  protected abstract createDefaultSettings(): PluginSettings;

  protected getTransformer(): Transformer {
    return defaultTransformer;
  }

  protected async prepareRecord(_record: Record<string, unknown>): Promise<void> {
    await noopAsync();
  }

  private getSettings(): Record<StringKeys<PluginSettings>, unknown> {
    const settings: Record<StringKeys<PluginSettings>, unknown> = {} as Record<StringKeys<PluginSettings>, unknown>;
    for (const [key, property] of this.properties.entries()) {
      settings[key as StringKeys<PluginSettings>] = property.get();
    }

    return settings;
  }
}
