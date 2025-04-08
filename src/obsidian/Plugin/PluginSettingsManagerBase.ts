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

import {
  noop,
  noopAsync
} from '../../Function.ts';
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

type PropertySetter = (value: unknown) => void;

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
    record[prop] = value;

    if (typeof prop !== 'string') {
      return true;
    }

    const property = this.properties.get(prop);
    if (!property) {
      return true;
    }

    property.setValue(value);
    this.validationPromise = this.validationPromise.then(() => property.validate());
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
 * @typeParam PluginTypes - Plugin-specific types.
 */
export abstract class PluginSettingsManagerBase<PluginTypes extends PluginTypesBase> {
  public readonly app: App;
  public readonly safeSettings: ReadonlyDeep<ExtractPluginSettings<PluginTypes>>;

  private readonly currentSettings: ExtractPluginSettings<PluginTypes>;
  private readonly properties: PropertiesMap<ExtractPluginSettings<PluginTypes>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly validators: Map<string, Validator<any>> = new Map<string, Validator<any>>();

  /**
   * Creates a new plugin settings manager.
   *
   * @param plugin - The plugin.
   */
  public constructor(public readonly plugin: ExtractPlugin<PluginTypes>) {
    this.app = plugin.app;
    this.currentSettings = this.createDefaultSettings();

    this.registerValidators();

    this.properties = new PropertiesMap<ExtractPluginSettings<PluginTypes>>();

    const record = this.currentSettings as Record<string, unknown>;

    for (const propertyName of getAllKeys(this.currentSettings)) {
      function propertySetter(value: unknown): void {
        record[propertyName] = value;
      }

      this.properties.set(
        propertyName,
        new PluginSettingsProperty(propertyName, this.currentSettings[propertyName], this.validators.get(propertyName) ?? noop, propertySetter)
      );
    }

    this.validators.clear();

    this.safeSettings = new Proxy(this.currentSettings, new SafeSettingsProxyHandler<ExtractPluginSettings<PluginTypes>>(this.properties)) as ReadonlyDeep<
      ExtractPluginSettings<PluginTypes>
    >;
  }

  /**
   * Edits the plugin settings and saves them.
   *
   * @param editor - The editor.
   * @param context - The context.
   * @returns A {@link Promise} that resolves when the settings are saved.
   */
  public async editAndSave(editor: (settings: ExtractPluginSettings<PluginTypes>) => Promisable<void>, context?: unknown): Promise<void> {
    const editableSettings = new Proxy(this.currentSettings, new EditableSettingsProxyHandler<ExtractPluginSettings<PluginTypes>>(this.properties)) as {
      validationPromise: Promise<void>;
    } & ExtractPluginSettings<PluginTypes>;
    await editor(editableSettings);
    await editableSettings.validationPromise;
    await this.saveToFile(context);
  }

  /**
   * Gets a property of the plugin settings.
   *
   * @param propertyName - The name of the property.
   * @returns The property.
   */
  public getProperty<PropertyName extends StringKeys<ExtractPluginSettings<PluginTypes>>>(
    propertyName: PropertyName
  ): PluginSettingsProperty<ExtractPluginSettings<PluginTypes>[PropertyName]> {
    return this.properties.getTyped(propertyName);
  }

  /**
   * Loads the plugin settings from the file.
   *
   * @param isInitialLoad - Whether the settings are being loaded for the first time.
   * @returns A {@link Promise} that resolves when the settings are loaded.
   */
  public async loadFromFile(isInitialLoad: boolean): Promise<void> {
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
        console.warn(
          'Possible invalid value type read from config file. It might lead to an unexpected behavior of the plugin. There is also a chance it is a false-negative warning, as we are unable to determine the exact type of the value in runtime.',
          {
            defaultValue: property.defaultValue as unknown,
            propertyName,
            value
          }
        );
      }

      property.setValue(value);
      propertiesToSave.push(property);
    }

    for (const property of propertiesToSave) {
      await property.validate();
      property.save();
    }

    const newJson = JSON.stringify(await this.prepareRecordToSave());

    if (newJson !== originalJson) {
      await this.saveToFileImpl();
    }

    await this.plugin.onLoadSettings(this.getSavedSettings(), isInitialLoad);
  }

  /**
   * Saves the new plugin settings.
   *
   * @param context - The context of the save to file operation.
   * @returns A {@link Promise} that resolves when the settings are saved.
   */
  public async saveToFile(context?: unknown): Promise<void> {
    const oldSettings = this.getSavedSettings();

    let hasChanges = false;

    for (const property of this.properties.values()) {
      hasChanges ||= property.save();
    }

    if (!hasChanges) {
      return;
    }

    await this.saveToFileImpl();
    await this.plugin.onSaveSettings(this.getSavedSettings(), oldSettings, context);
  }

  protected abstract createDefaultSettings(): ExtractPluginSettings<PluginTypes>;

  /**
   * Gets the transformer.
   *
   * @returns The transformer.
   */
  protected getTransformer(): Transformer {
    return defaultTransformer;
  }

  /**
   * Called when the plugin settings are loaded.
   *
   * @param _record - The record.
   */
  protected async onLoadRecord(_record: Record<string, unknown>): Promise<void> {
    await noopAsync();
  }

  /**
   * Called when the plugin settings are saving.
   *
   * @param _record - The record.
   */
  protected async onSavingRecord(_record: Record<string, unknown>): Promise<void> {
    await noopAsync();
  }

  /**
   * Registers a validator for a property.
   *
   * @param propertyName - The name of the property.
   * @param validator - The validator.
   */
  protected registerValidator<PropertyName extends StringKeys<ExtractPluginSettings<PluginTypes>>>(
    propertyName: PropertyName,
    validator: Validator<ExtractPluginSettings<PluginTypes>[PropertyName]>
  ): void {
    this.validators.set(propertyName, validator);
  }

  /**
   * Registers the validators.
   *
   * This method can be overridden by subclasses to register validators for properties.
   */
  protected registerValidators(): void {
    noop();
  }

  private getSavedSettings(): ExtractPluginSettings<PluginTypes> {
    const savedSettings: Record<string, unknown> = {};
    for (const [propertyName, property] of this.properties.entries()) {
      savedSettings[propertyName] = property.lastSavedValue as
        | ExtractPluginSettings<PluginTypes>[StringKeys<ExtractPluginSettings<PluginTypes>>]
        | undefined;
    }
    const proto = Object.getPrototypeOf(this.currentSettings) as object;
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
  /**
   * The current value of the property.
   *
   * @returns The current value.
   */
  public get currentValue(): T {
    return this._currentValue;
  }

  /**
   * The last saved value of the property.
   *
   * @returns The last saved value.
   */
  public get lastSavedValue(): T {
    return this._lastSavedValue;
  }

  /**
   * The safe value of the property.
   *
   * @returns The safe value.
   */
  public get safeValue(): T {
    return this._validationMessage ? this.defaultValue : this._currentValue;
  }

  /**
   * The validation message of the property.
   *
   * @returns The validation message.
   */
  public get validationMessage(): string {
    return this._validationMessage;
  }

  private _currentValue: T;

  private _lastSavedValue: T;

  private _validationMessage = '';

  /**
   * Creates a new plugin settings property.
   *
   * @param propertyName - The name of the property.
   * @param defaultValue - The default value of the property.
   * @param validator - The validator of the property.
   * @param propertySetter - The property setter of the property.
   */
  public constructor(
    private readonly propertyName: string,
    public readonly defaultValue: T,
    private readonly validator: Validator<T>,
    private readonly propertySetter: PropertySetter
  ) {
    this._lastSavedValue = defaultValue;
    this._currentValue = defaultValue;
  }

  /**
   * Resets the current value of the property to the default value.
   */
  public reset(): void {
    this._currentValue = this.defaultValue;
    this._validationMessage = '';
  }

  /**
   * Saves the current value of the property.
   *
   * @returns `true` if the value was changed, `false` otherwise.
   */
  public save(): boolean {
    if (this._lastSavedValue === this._currentValue) {
      return false;
    }

    this._lastSavedValue = this._currentValue;
    return true;
  }

  /**
   * Sets the validation message of the property.
   *
   * @param validationMessage - The validation message.
   */
  public setValidationMessage(validationMessage: string): void {
    this._validationMessage = validationMessage;
    this.showWarning();
  }

  /**
   * Sets the current value of the property.
   *
   * @param value - The value to set.
   */
  public setValue(value: T): void {
    this._currentValue = value;
    this.propertySetter(value);
  }

  /**
   * Validates the current value of the property.
   *
   * @returns A {@link Promise} that resolves when the validation is complete.
   */
  public async validate(): Promise<void> {
    try {
      this._validationMessage = (await this.validator(this._currentValue) as string | undefined) ?? '';
    } catch (error) {
      console.error('Validation failed', {
        propertyName: this.propertyName,
        value: this._currentValue
      }, error);
      this._validationMessage = 'Validation failed';
    }
    this.showWarning(this._currentValue);
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
