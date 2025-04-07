/**
 * @packageDocumentation
 *
 * Plugin settings manager base class.
 */

import type { App } from 'obsidian';
import type {
  Promisable,
  ReadonlyDeep
} from 'type-fest';

import type { Transformer } from '../../Transformers/Transformer.ts';
import type {
  MaybeReturn,
  StringKeys
} from '../../Type.ts';
import type {
  ExtractPlugin,
  ExtractPluginSettings,
  PluginTypesBase
} from './PluginTypesBase.ts';

import { noop } from '../../Function.ts';
import { getAllKeys } from '../../Object.ts';
import { DateTransformer } from '../../Transformers/DateTransformer.ts';
import { DurationTransformer } from '../../Transformers/DurationTransformer.ts';
import { GroupTransformer } from '../../Transformers/GroupTransformer.ts';
import { SkipPrivatePropertyTransformer } from '../../Transformers/SkipPrivatePropertyTransformer.ts';

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

    property.setValue(value);
    this.validationPromise = this.validationPromise.then(() => property.setValueAndValidate(value));

    return true;
  }

  protected override getPropertyValue(property: PluginSettingsProperty<unknown>): unknown {
    return property.currentValue;
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
    return property.safeValue;
  }
}

/**
 * Base class for managing plugin settings.
 *
 * @typeParam PluginSettings - The type representing the plugin settings object.
 */

export abstract class PluginSettingsManagerBase<PluginTypes extends PluginTypesBase> {
  public readonly app: App;
  public readonly safeSettings: ReadonlyDeep<ExtractPluginSettings<PluginTypes>>;

  private defaultSettings: ExtractPluginSettings<PluginTypes>;
  private properties: PropertiesMap<ExtractPluginSettings<PluginTypes>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private validators: Map<string, Validator<any>> = new Map<string, Validator<any>>();

  public constructor(public readonly plugin: ExtractPlugin<PluginTypes>) {
    this.app = plugin.app;
    this.defaultSettings = this.createDefaultSettings();

    this.addValidators();

    this.properties = new PropertiesMap<ExtractPluginSettings<PluginTypes>>();

    for (const propertyName of getAllKeys(this.defaultSettings)) {
      this.properties.set(
        propertyName,
        new PluginSettingsProperty(propertyName, this.defaultSettings[propertyName], this.validators.get(propertyName) ?? noop)
      );
    }

    this.validators.clear();

    this.safeSettings = new Proxy(this.defaultSettings, new SafeSettingsProxyHandler<ExtractPluginSettings<PluginTypes>>(this.properties)) as ReadonlyDeep<
      ExtractPluginSettings<PluginTypes>
    >;
  }

  public async editAndSave(editor: (settings: ExtractPluginSettings<PluginTypes>) => Promisable<void>): Promise<void> {
    const editableSettings = new Proxy(this.defaultSettings, new EditableSettingsProxyHandler<ExtractPluginSettings<PluginTypes>>(this.properties)) as {
      validationPromise: Promise<void>;
    } & ExtractPluginSettings<PluginTypes>;
    await editor(editableSettings);
    await editableSettings.validationPromise;
    await this.saveToFile();
  }

  public getProperty<PropertyName extends StringKeys<ExtractPluginSettings<PluginTypes>>>(
    propertyName: PropertyName
  ): PluginSettingsProperty<ExtractPluginSettings<PluginTypes>[PropertyName]> {
    return this.properties.getTyped(propertyName);
  }

  public async loadFromFile(): Promise<void> {
    for (const property of this.properties.values()) {
      property.reset();
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
    const originalJson = JSON.stringify(record);
    record = this.getTransformer().transformObjectRecursively(record);
    await this.onLoadRecord(record);

    const propertiesToSave: PluginSettingsProperty<unknown>[] = [];

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

      property.setValue(value);
      propertiesToSave.push(property);
    }

    for (const property of propertiesToSave) {
      await property.setValueAndValidate(property.currentValue);
      property.save();
    }

    const newJson = JSON.stringify(await this.prepareRecordToSave());

    if (newJson !== originalJson) {
      await this.saveToFileImpl();
    }

    await this.plugin.onLoadSettings(this.getSavedSettings());
  }

  /**
   * Saves the new plugin settings.
   *
   * @returns A {@link Promise} that resolves when the settings are saved.
   */
  public async saveToFile(): Promise<void> {
    const oldSettings = this.getSavedSettings();

    let hasChanges = false;

    for (const property of this.properties.values()) {
      hasChanges ||= property.save();
    }

    if (!hasChanges) {
      return;
    }

    await this.saveToFileImpl();
    await this.plugin.onSaveSettings(this.getSavedSettings(), oldSettings);
  }

  protected addValidator<PropertyName extends StringKeys<ExtractPluginSettings<PluginTypes>>>(
    propertyName: PropertyName,
    validator: Validator<ExtractPluginSettings<PluginTypes>[PropertyName]>
  ): void {
    this.validators.set(propertyName, validator);
  }

  protected addValidators(): void {
    noop();
  }

  protected abstract createDefaultSettings(): ExtractPluginSettings<PluginTypes>;

  protected getTransformer(): Transformer {
    return defaultTransformer;
  }

  /**
   * Called when the plugin settings are loaded.
   *
   * @param _record - The record.
   */
  protected onLoadRecord(_record: Record<string, unknown>): Promisable<void> {
    noop();
  }

  /**
   * Called when the plugin settings are saving.
   *
   * @param _record - The record.
   */
  protected onSavingRecord(_record: Record<string, unknown>): Promisable<void> {
    noop();
  }

  private getSavedSettings(): ExtractPluginSettings<PluginTypes> {
    const savedSettings: Record<string, unknown> = {};
    for (const [propertyName, property] of this.properties.entries()) {
      savedSettings[propertyName] = property.lastSavedValue as
        | ExtractPluginSettings<PluginTypes>[StringKeys<ExtractPluginSettings<PluginTypes>>]
        | undefined;
    }
    const proto = Object.getPrototypeOf(this.defaultSettings) as object;
    Object.setPrototypeOf(savedSettings, proto);

    return savedSettings as ExtractPluginSettings<PluginTypes>;
  }

  private async prepareRecordToSave(): Promise<Record<string, unknown>> {
    const settings: Record<string, unknown> = {};
    for (const [propertyName, property] of this.properties.entries()) {
      settings[propertyName] = property.currentValue as unknown;
    }

    await this.onSavingRecord(settings);

    return this.getTransformer().transformObjectRecursively(settings);
  }

  private async saveToFileImpl(): Promise<void> {
    await this.plugin.saveData(await this.prepareRecordToSave());
  }
}

/**
 * A property of a plugin settings.
 *
 * @typeParam T - The type of the property.
 */
export class PluginSettingsProperty<T> {
  public get currentValue(): T {
    return this._currentValue;
  }

  public get lastSavedValue(): T {
    return this._lastSavedValue;
  }

  public get safeValue(): T {
    return this._validationMessage ? this.defaultValue : this._currentValue;
  }

  public get validationMessage(): string {
    return this._validationMessage;
  }

  private _currentValue: T;

  private _lastSavedValue: T;

  private _validationMessage = '';

  public constructor(private readonly propertyName: string, public readonly defaultValue: T, private readonly validator: Validator<T>) {
    this._lastSavedValue = defaultValue;
    this._currentValue = defaultValue;
  }

  public reset(): void {
    this._currentValue = this.defaultValue;
    this._validationMessage = '';
  }

  public save(): boolean {
    if (this._lastSavedValue === this._currentValue) {
      return false;
    }

    this._lastSavedValue = this._currentValue;
    return true;
  }

  public setValidationMessage(validationMessage: string): void {
    this._validationMessage = validationMessage;
    this.showWarning();
  }

  public setValue(value: T): void {
    this._currentValue = value;
  }

  public async setValueAndValidate(value: T): Promise<void> {
    this.setValue(value);
    try {
      this._validationMessage = (await this.validator(this._currentValue) as string | undefined) ?? '';
    } catch (error) {
      console.error('Validation failed', {
        propertyName: this.propertyName,
        value
      }, error);
      this._validationMessage = 'Validation failed';
    }
    this.showWarning(value);
  }

  private showWarning(value?: T): void {
    if (!this._validationMessage) {
      return;
    }

    console.warn(`Could not set plugin setting: ${this.propertyName}. Using default value instead.`, {
      defaultValue: this.defaultValue,
      propertyName: this.propertyName,
      validationMessage: this._validationMessage,
      value
    });
  }
}
