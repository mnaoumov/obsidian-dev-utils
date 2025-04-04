import type {
  Promisable,
  ReadonlyDeep
} from 'type-fest';

import type {
  MaybeReturn,
  StringKeys
} from '../../Object.ts';
import type { Transformer } from '../../Transformers/Transformer.ts';
import type { ValidationMessageHolder } from '../ValidationMessage.ts';
import type { PluginBase } from './PluginBase.ts';

import { noop } from '../../Function.ts';
import { DateTransformer } from '../../Transformers/DateTransformer.ts';
import { DurationTransformer } from '../../Transformers/DurationTransformer.ts';
import { GroupTransformer } from '../../Transformers/GroupTransformer.ts';
import { SkipPrivatePropertyTransformer } from '../../Transformers/SkipPrivatePropertyTransformer.ts';
import { isValidationMessageHolder } from '../ValidationMessage.ts';

const defaultTransformer = new GroupTransformer([
  new SkipPrivatePropertyTransformer(),
  new DateTransformer(),
  new DurationTransformer()
]);

type Validator<T> = (value: T) => Promisable<MaybeReturn<string>>;

abstract class ProxyHandlerBase<PluginSettings extends object> implements ProxyHandler<PluginSettings> {
  public constructor(protected readonly properties: PropertiesMap<PluginSettings>) {}

  public get(target: PluginSettings, prop: string | symbol): unknown {
    const record = target as Record<string | symbol, unknown>;
    if (typeof prop !== 'string') {
      return record[prop];
    }

    const propertyObj = this.properties.get(prop);
    if (!propertyObj) {
      return record[prop];
    }

    return this.getPropertyValue(propertyObj);
  }

  protected abstract getPropertyValue(propertyObj: PluginSettingsProperty<unknown>): unknown;
}

class EditableSettingsProxyHandler<PluginSettings extends object> extends ProxyHandlerBase<PluginSettings> {
  private validationPromise = Promise.resolve();
  public set(target: PluginSettings, prop: string | symbol, value: unknown): boolean {
    const record = target as Record<string | symbol, unknown>;

    if (typeof prop !== 'string') {
      record[prop] = value;
      return true;
    }

    const propertyObj = this.properties.get(prop);
    if (!propertyObj) {
      record[prop] = value;
      return true;
    }

    propertyObj.set(value);
    this.validationPromise = this.validationPromise.then(() => propertyObj.setAndValidate(value));

    return true;
  }

  protected override getPropertyValue(propertyObj: PluginSettingsProperty<unknown>): unknown {
    return propertyObj.get();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class PropertiesMap<PluginSettings extends object> extends Map<string, PluginSettingsProperty<any>> {
  public getTyped<Property extends StringKeys<PluginSettings>>(key: Property): PluginSettingsProperty<PluginSettings[Property]> {
    const property = super.get(key);
    if (!property) {
      throw new Error(`Property ${String(key)} not found`);
    }

    return property as PluginSettingsProperty<PluginSettings[Property]>;
  }

  public setTyped<Property extends StringKeys<PluginSettings>>(key: Property, value: PluginSettingsProperty<PluginSettings[Property]>): this {
    return super.set(key, value);
  }
}

class SafeSettingsProxyHandler<PluginSettings extends object> extends ProxyHandlerBase<PluginSettings> {
  protected override getPropertyValue(propertyObj: PluginSettingsProperty<unknown>): unknown {
    return propertyObj.getSafe();
  }
}

/**
 * Base class for managing plugin settings.
 *
 * @typeParam PluginSettings - The type representing the plugin settings object.
 */
export abstract class PluginSettingsManagerBase<PluginSettings extends object> {
  public readonly safeSettings: ReadonlyDeep<PluginSettings>;

  private defaultSettings: PluginSettings;
  private properties: PropertiesMap<PluginSettings>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private validators: Map<string, Validator<any>> = new Map<string, Validator<any>>();

  public constructor(private plugin: PluginBase<PluginSettings>) {
    this.defaultSettings = this.createDefaultSettings();

    this.addValidators();

    this.properties = new PropertiesMap<PluginSettings>();

    for (const key of Object.keys(this.defaultSettings) as StringKeys<PluginSettings>[]) {
      this.properties.set(key, new PluginSettingsProperty(this.defaultSettings[key], this.validators.get(key) ?? noop));
    }

    this.validators.clear();

    this.safeSettings = new Proxy(this.defaultSettings, new SafeSettingsProxyHandler<PluginSettings>(this.properties)) as ReadonlyDeep<PluginSettings>;
  }

  public async editAndSave(editor: (settings: PluginSettings) => Promisable<void>): Promise<void> {
    const editableSettings = new Proxy(this.defaultSettings, new EditableSettingsProxyHandler<PluginSettings>(this.properties)) as {
      validationPromise: Promise<void>;
    } & PluginSettings;
    await editor(editableSettings);
    await editableSettings.validationPromise;
    await this.saveToFile();
  }

  public getProperty<Property extends StringKeys<PluginSettings>>(property: Property): PluginSettingsProperty<PluginSettings[Property]> {
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
    const beforePrepareJson = JSON.stringify(record);
    await this.prepareRecord(record);
    const afterPrepareJson = JSON.stringify(record);

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

      await propertyObj.setAndValidate(value);
    }

    if (afterPrepareJson !== beforePrepareJson) {
      await this.saveToFile();
    }
  }

  /**
   * Saves the new plugin settings.
   *
   * @returns A promise that resolves when the settings are saved.
   */
  public async saveToFile(): Promise<void> {
    const oldSettings = this.getSavedSettings();

    for (const property of this.properties.values()) {
      property.save();
    }

    const record = this.getTransformer().transformObjectRecursively(this.getSettingsRecord());
    await this.plugin.saveData(record);

    await this.plugin.onSaveSettings(this.getSavedSettings(), oldSettings);
  }

  protected addValidator<Property extends StringKeys<PluginSettings>>(property: Property, validator: Validator<PluginSettings[Property]>): void {
    this.validators.set(property, validator);
  }

  protected addValidators(): void {
    noop();
  }

  protected abstract createDefaultSettings(): PluginSettings;

  protected getTransformer(): Transformer {
    return defaultTransformer;
  }

  protected prepareRecord(_record: Record<string, unknown>): Promisable<void> {
    noop();
  }

  private getSavedSettings(): Partial<PluginSettings> {
    const savedSettings: Partial<PluginSettings> = {};
    for (const [key, property] of this.properties.entries()) {
      savedSettings[key as StringKeys<PluginSettings>] = property.getSaved() as PluginSettings[StringKeys<PluginSettings>] | undefined;
    }
    const proto = Object.getPrototypeOf(this.defaultSettings) as object;
    Object.setPrototypeOf(savedSettings, proto);
    return savedSettings;
  }

  private getSettingsRecord(): Record<StringKeys<PluginSettings>, unknown> {
    const settings: Record<StringKeys<PluginSettings>, unknown> = {} as Record<StringKeys<PluginSettings>, unknown>;
    for (const [key, property] of this.properties.entries()) {
      settings[key as StringKeys<PluginSettings>] = property.get() as unknown;
    }

    return settings;
  }
}

/**
 * A property of a plugin settings.
 *
 * @typeParam T - The type of the property.
 */
export class PluginSettingsProperty<T> {
  public get validationMessage(): string {
    return this._validationMessage;
  }

  private _validationMessage = '';

  private savedValue: T | undefined;

  private value: T | undefined;
  public constructor(public readonly defaultValue: T, private readonly validator: Validator<T>) {}

  public clear(): void {
    this.value = undefined;
    this._validationMessage = '';
  }

  public get(): T {
    return this.value ?? this.defaultValue;
  }

  public getSafe(): T {
    return this._validationMessage ? this.defaultValue : this.get();
  }

  public getSaved(): T | undefined {
    return this.savedValue;
  }

  public save(): void {
    this.savedValue = this.value;
  }

  public set(value: T | undefined | ValidationMessageHolder): void {
    if (isValidationMessageHolder(value)) {
      this._validationMessage = value.validationMessage;
    } else {
      this.value = value;
    }
  }

  public async setAndValidate(value: T | undefined | ValidationMessageHolder): Promise<void> {
    this.set(value);
    if (this.value === undefined) {
      return;
    }

    this._validationMessage = (await this.validator(this.value) as string | undefined) ?? '';
  }
}
