import type {
  Promisable,
  ReadonlyDeep
} from 'type-fest';

import { Notice } from 'obsidian';

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

    const property = this.properties.get(prop);
    if (!property) {
      return record[prop];
    }

    return this.getPropertyValue(property);
  }

  protected abstract getPropertyValue(property: PluginSettingsProperty<unknown>): unknown;
}

class EditableSettingsProxyHandler<PluginSettings extends object> extends ProxyHandlerBase<PluginSettings> {
  private validationPromise = Promise.resolve();
  public set(target: PluginSettings, prop: string | symbol, value: unknown): boolean {
    const record = target as Record<string | symbol, unknown>;

    if (typeof prop !== 'string') {
      record[prop] = value;
      return true;
    }

    const property = this.properties.get(prop);
    if (!property) {
      record[prop] = value;
      return true;
    }

    property.set(value);
    this.validationPromise = this.validationPromise.then(() => property.setAndValidate(value));

    return true;
  }

  protected override getPropertyValue(property: PluginSettingsProperty<unknown>): unknown {
    return property.get();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class PropertiesMap<PluginSettings extends object> extends Map<string, PluginSettingsProperty<any>> {
  public getTyped<PropertyName extends StringKeys<PluginSettings>>(propertyName: PropertyName): PluginSettingsProperty<PluginSettings[PropertyName]> {
    const property = super.get(propertyName);
    if (!property) {
      throw new Error(`Property ${String(propertyName)} not found`);
    }

    return property as PluginSettingsProperty<PluginSettings[PropertyName]>;
  }

  public setTyped<PropertyName extends StringKeys<PluginSettings>>(
    propertyName: PropertyName,
    value: PluginSettingsProperty<PluginSettings[PropertyName]>
  ): this {
    return super.set(propertyName, value);
  }
}

class SafeSettingsProxyHandler<PluginSettings extends object> extends ProxyHandlerBase<PluginSettings> {
  protected override getPropertyValue(property: PluginSettingsProperty<unknown>): unknown {
    return property.getSafe();
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

    for (const propertyName of Object.keys(this.defaultSettings) as StringKeys<PluginSettings>[]) {
      this.properties.set(
        propertyName,
        new PluginSettingsProperty(propertyName, this.defaultSettings[propertyName], this.validators.get(propertyName) ?? noop)
      );
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

  public getProperty<PropertyName extends StringKeys<PluginSettings>>(propertyName: PropertyName): PluginSettingsProperty<PluginSettings[PropertyName]> {
    return this.properties.getTyped(propertyName);
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

    for (const [propertyName, value] of Object.entries(record)) {
      const property = this.properties.get(propertyName);
      if (!property) {
        console.warn(`Unknown property: ${propertyName}`);
        continue;
      }

      if (typeof value !== typeof property.defaultValue) {
        console.warn('Invalid value type', {
          propertyName,
          propertyType: typeof property.defaultValue,
          value
        });
        continue;
      }

      await property.setAndValidate(value);
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

  protected addValidator<PropertyName extends StringKeys<PluginSettings>>(
    propertyName: PropertyName,
    validator: Validator<PluginSettings[PropertyName]>
  ): void {
    this.validators.set(propertyName, validator);
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
    for (const [propertyName, property] of this.properties.entries()) {
      savedSettings[propertyName as StringKeys<PluginSettings>] = property.getSaved() as PluginSettings[StringKeys<PluginSettings>] | undefined;
    }
    const proto = Object.getPrototypeOf(this.defaultSettings) as object;
    Object.setPrototypeOf(savedSettings, proto);
    return savedSettings;
  }

  private getSettingsRecord(): Record<StringKeys<PluginSettings>, unknown> {
    const settings: Record<StringKeys<PluginSettings>, unknown> = {} as Record<StringKeys<PluginSettings>, unknown>;
    for (const [propertyName, property] of this.properties.entries()) {
      settings[propertyName as StringKeys<PluginSettings>] = property.get() as unknown;
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
  public constructor(private readonly propertyName: string, public readonly defaultValue: T, private readonly validator: Validator<T>) {}

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

    if (!this._validationMessage) {
      return;
    }

    const warningMessage = `Could not set plugin setting: ${this.propertyName}. Using default value instead.`;
    new Notice(warningMessage);
    console.warn(warningMessage, {
      defaultValue: this.defaultValue,
      propertyName: this.propertyName,
      validationMessage: this._validationMessage,
      value
    });
  }
}
