/**
 * @file
 *
 * Component that manages plugin settings: data, persistence, validation, and events.
 *
 * This is the single public-facing settings API for plugin authors.
 * All settings logic (load, save, validate, transform, clone) is handled directly
 * by this component — no separate manager class is needed.
 */

import type {
  Constructor,
  Promisable,
  ReadonlyDeep
} from 'type-fest';

import type {
  AsyncEventRef,
  AsyncEventSource
} from '../../async-events.ts';
import type { Transformer } from '../../transformers/transformer.ts';
import type { GenericObject } from '../../type-guards.ts';
import type {
  MaybeReturn,
  StringKeys
} from '../../type.ts';
import type { DataHandler } from '../data-handler.ts';
import type { PluginEventSource } from '../plugin/plugin-event-source.ts';

import { AsyncEvents } from '../../async-events.ts';
import { getLibDebugger } from '../../debug.ts';
import {
  noop,
  noopAsync
} from '../../function.ts';
import {
  castTo,
  deepEqual,
  getAllKeys
} from '../../object-utils.ts';
import { DateTransformer } from '../../transformers/date-transformer.ts';
import { DurationTransformer } from '../../transformers/duration-transformer.ts';
import { GroupTransformer } from '../../transformers/group-transformer.ts';
import { MapTransformer } from '../../transformers/map-transformer.ts';
import { SetTransformer } from '../../transformers/set-transformer.ts';
import { SkipPrivatePropertyTransformer } from '../../transformers/skip-private-property-transformer.ts';
import { TwoWayMapTransformer } from '../../transformers/two-way-map-transformer.ts';
import { registerAsyncEvent } from './async-events-component.ts';
import { ComponentEx } from './component-ex.ts';

const defaultTransformer = new GroupTransformer([
  new SkipPrivatePropertyTransformer(),
  new DateTransformer(),
  new DurationTransformer(),
  new MapTransformer(),
  new SetTransformer(),
  new TwoWayMapTransformer()
]);

/**
 * Constructor parameters for {@link PluginSettingsComponentBase}.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
export interface PluginSettingsComponentBaseConstructorParams<PluginSettings> {
  /**
   * The data handler for the plugin.
   */
  readonly dataHandler: DataHandler;

  /**
   * The plugin events.
   */
  readonly pluginEventSource: PluginEventSource;

  /**
   * The plugin settings class.
   */
  readonly pluginSettingsClass: Constructor<PluginSettings, []>;
}

/**
 * A snapshot of plugin settings state, including raw input values, effective (validated) values,
 * and per-property validation messages.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
export interface PluginSettingsState<PluginSettings extends object> {
  /**
   * The effective settings values used by the plugin. Invalid properties are replaced with defaults.
   */
  effectiveValues: PluginSettings;

  /**
   * The raw input values as entered by the user. May contain invalid values.
   */
  inputValues: PluginSettings;

  /**
   * Per-property validation messages. Empty string means valid.
   */
  validationMessages: Record<StringKeys<PluginSettings>, string>;
}

/**
 * Readonly version of {@link PluginSettings}.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
export type ReadonlyPluginSettings<PluginSettings extends object> = ReadonlyDeep<PluginSettings>;

/**
 * Readonly version of {@link PluginSettingsState} for use in event callbacks and public getters.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
export type ReadonlyPluginSettingsState<PluginSettings extends object> = ReadonlyDeep<PluginSettingsState<PluginSettings>>;

/**
 * A validator function for a settings property.
 *
 * @typeParam PluginSettings - The plugin settings type.
 * @typeParam PropertyName - The property name.
 */
export type SettingsValidator<PluginSettings extends object, PropertyName extends StringKeys<PluginSettings> = StringKeys<PluginSettings>> = (
  value: PluginSettings[PropertyName],
  settings: PluginSettings
) => Promisable<MaybeReturn<string>>;

interface PluginSettingsComponentBaseEventMap<PluginSettings extends object> {
  loadSettings: [
    loadedState: ReadonlyPluginSettingsState<PluginSettings>,
    isInitialLoad: boolean
  ];
  saveSettings: [
    newState: ReadonlyPluginSettingsState<PluginSettings>,
    oldState: ReadonlyPluginSettingsState<PluginSettings>,
    context: unknown
  ];
}

type PropertyNames<PluginSettings extends object> = StringKeys<PluginSettings>;

type PropertyValues<PluginSettings extends object> = PluginSettings[PropertyNames<PluginSettings>];

type ValidationResult<PluginSettings extends object> = Partial<Record<StringKeys<PluginSettings>, string>>;

/**
 * Base class for plugin settings components.
 *
 * Manages settings data, persistence, validation, and events.
 * Plugin authors extend this class and implement {@link createDefaultSettings}.
 *
 * @typeParam PluginSettings - The plugin settings type.
 */
// eslint-disable-next-line obsidian-dev-utils/require-component-suffix -- Non-abstract base class; consumers extend it.
export class PluginSettingsComponentBase<PluginSettings extends object> extends ComponentEx implements AsyncEventSource<PluginSettingsComponentBaseEventMap<PluginSettings>> {
  /**
   * Gets the readonly default settings.
   *
   * @returns The default settings (as a readonly object).
   */
  public readonly defaultSettings: ReadonlyDeep<PluginSettings>;

  /**
   * Gets the readonly effective settings (validated, with defaults substituted for invalid values).
   *
   * @returns The readonly effective settings.
   */
  public get settings(): ReadonlyDeep<PluginSettings> {
    return this.settingsState.effectiveValues;
  }

  /**
   * Gets the current settings state snapshot.
   *
   * @returns The current settings state.
   */
  public get settingsState(): ReadonlyPluginSettingsState<PluginSettings> {
    return this.currentState as ReadonlyPluginSettingsState<PluginSettings>;
  }

  private readonly asyncEvents = new AsyncEvents<PluginSettingsComponentBaseEventMap<PluginSettings>>();
  private currentState: PluginSettingsState<PluginSettings>;
  private readonly dataHandler: DataHandler;
  private lastSavedState: PluginSettingsState<PluginSettings>;
  private readonly legacySettingsConverters: ((record: GenericObject) => void)[] = [];

  private readonly pluginEventSource: PluginEventSource;
  private readonly pluginSettingsClass: Constructor<PluginSettings, []>;
  private readonly propertyNames: PropertyNames<PluginSettings>[];

  private readonly validators = new Map<PropertyNames<PluginSettings>, SettingsValidator<PluginSettings>>();

  /**
   * Creates a new plugin settings component.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: PluginSettingsComponentBaseConstructorParams<PluginSettings>) {
    super();
    this.dataHandler = params.dataHandler;
    this.pluginSettingsClass = params.pluginSettingsClass;
    this.pluginEventSource = params.pluginEventSource;

    this.defaultSettings = new this.pluginSettingsClass() as ReadonlyDeep<PluginSettings>;
    this.currentState = this.createDefaultState();
    this.lastSavedState = this.createDefaultState();
    this.propertyNames = getAllKeys(this.currentState.inputValues);
    this.registerValidators();
    this.registerLegacySettingsConverters();
  }

  /**
   * Edits the plugin settings and saves them.
   *
   * @param settingsEditor - The editor.
   * @param context - The context.
   * @returns A {@link Promise} that resolves when the settings are saved.
   */
  public async editAndSave(settingsEditor: (settings: PluginSettings) => Promisable<void>, context?: unknown): Promise<void> {
    this.ensureLoaded();
    await this.edit(settingsEditor);
    await this.saveToFile(context);
  }

  /**
   * Ensures the settings are safe.
   *
   * It runs validation for each property and sets the default value if the validation fails.
   *
   * @param settings - The settings.
   * @returns A {@link Promise} that resolves when the settings are safe.
   */
  public async ensureSafe(settings: PluginSettings): Promise<void> {
    const validationResult = await this.validate(settings);
    const defaults = this.defaultSettings as PluginSettings;
    for (const propertyName of this.propertyNames) {
      if (validationResult[propertyName]) {
        settings[propertyName] = defaults[propertyName];
      }
    }
  }

  /**
   * Gets a safe copy of the settings.
   *
   * @param settings - The settings.
   * @returns A {@link Promise} that resolves to the safe copy of the settings.
   */
  public async getSafeCopy(settings: PluginSettings): Promise<PluginSettings> {
    const safeSettings = await this.cloneSettings(settings);
    await this.ensureSafe(safeSettings);
    return safeSettings;
  }

  /**
   * Loads the plugin settings from the file.
   *
   * @param isInitialLoad - Whether the settings are being loaded for the first time.
   * @returns A {@link Promise} that resolves when the settings are loaded.
   */
  public async loadFromFile(isInitialLoad: boolean): Promise<void> {
    this.ensureLoaded();
    const data = await this.dataHandler.loadData();
    this.lastSavedState = this.createDefaultState();
    this.currentState = this.createDefaultState();

    try {
      if (data === undefined || data === null) {
        return;
      }

      if (typeof data !== 'object') {
        console.error(`Invalid settings from data.json. Expected Object, got: ${typeof data}`);
        return;
      }

      const rawRecord = data as GenericObject;
      const parsedSettings = await this.rawRecordToSettings(rawRecord);
      const validationResult = await this.validate(parsedSettings);

      for (const propertyName of this.propertyNames) {
        this.setPropertyImpl(propertyName, parsedSettings[propertyName], validationResult[propertyName]);
      }

      this.lastSavedState = await this.cloneState(this.currentState);

      const newRecord = await this.settingsToRawRecord(this.currentState.inputValues);

      if (!deepEqual(newRecord, data)) {
        await this.saveToFileImpl();
      }
    } finally {
      await this.asyncEvents.triggerAsync('loadSettings', this.currentState as ReadonlyPluginSettingsState<PluginSettings>, isInitialLoad);
    }
  }

  /**
   * Remove an event listener.
   *
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The types of the arguments the event callback accepts.
   * @param name - The name of the event.
   * @param callback - The callback to remove.
   */
  public off<
    EventName extends keyof PluginSettingsComponentBaseEventMap<PluginSettings>,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
    Args extends EventName extends keyof PluginSettingsComponentBaseEventMap<PluginSettings> ? PluginSettingsComponentBaseEventMap<PluginSettings>[EventName]
      : unknown[]
  >(name: EventName, callback: (...args: Args) => Promisable<void>): void {
    this.asyncEvents.off(name, callback);
  }

  /**
   * Remove an event listener by reference.
   *
   * @param eventRef - The reference to the event listener.
   */
  public offref(eventRef: AsyncEventRef): void {
    this.asyncEvents.offref(eventRef);
  }

  /**
   * Add an event listener.
   *
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The types of the arguments the event callback accepts.
   * @param name - The name of the event.
   * @param callback - The callback to call when the event is triggered.
   * @param thisArg - The context passed as `this` to the `callback`.
   * @returns A reference to the event listener.
   */
  public on<
    EventName extends keyof PluginSettingsComponentBaseEventMap<PluginSettings>,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
    Args extends EventName extends keyof PluginSettingsComponentBaseEventMap<PluginSettings> ? PluginSettingsComponentBaseEventMap<PluginSettings>[EventName]
      : unknown[]
  >(name: EventName, callback: (...args: Args) => Promisable<void>, thisArg?: unknown): AsyncEventRef {
    return this.asyncEvents.on(name, callback, thisArg);
  }

  /**
   * Trigger an event, executing all the listeners in order even if some of them throw an error.
   *
   * Add an event listener that will be called only once.
   *
   * @typeParam EventName - The name of the event.
   * @typeParam Args - The types of the arguments the event callback accepts.
   * @param name - The name of the event.
   * @param callback - The callback to call when the event is triggered.
   * @param thisArg - The context passed as `this` to the `callback`.
   * @returns A reference to the event listener.
   */
  public once<
    EventName extends keyof PluginSettingsComponentBaseEventMap<PluginSettings>,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We need to use the dummy parameter to get type inference.
    Args extends EventName extends keyof PluginSettingsComponentBaseEventMap<PluginSettings> ? PluginSettingsComponentBaseEventMap<PluginSettings>[EventName]
      : unknown[]
  >(name: EventName, callback: (...args: Args) => Promisable<void>, thisArg?: unknown): AsyncEventRef {
    return this.asyncEvents.once(name, callback, thisArg);
  }

  /**
   * Called when the external settings change.
   *
   * @returns A {@link Promise} that resolves when the settings are reloaded.
   */
  public async onExternalSettingsChange(): Promise<void> {
    this.ensureLoaded();
    await this.loadFromFile(false);
  }

  /**
   * Loads settings from file and registers event handlers.
   */
  public override async onloadAsync(): Promise<void> {
    registerAsyncEvent(this, this.on('loadSettings', this.onLoadSettings.bind(this)));
    registerAsyncEvent(this, this.on('saveSettings', this.onSaveSettings.bind(this)));
    registerAsyncEvent(this, this.pluginEventSource.on('externalSettingsChange', this.onExternalSettingsChange.bind(this)));
    await this.loadFromFile(true);
  }

  /**
   * Registers a legacy settings converter.
   *
   * @typeParam LegacySettings - The legacy settings class.
   * @param legacySettingsClass - The legacy settings class.
   * @param converter - The converter.
   */
  public registerLegacySettingsConverter<LegacySettings extends object>(
    legacySettingsClass: new () => LegacySettings,
    converter: (legacySettings: Partial<LegacySettings> & Partial<PluginSettings>) => void
  ): void {
    const that = this;
    this.legacySettingsConverters.push(legacySettingsConverter);

    function legacySettingsConverter(record: GenericObject): void {
      const legacySettingsKeys = new Set<string>(Object.keys(new legacySettingsClass()));
      const pluginSettingKeys = new Set<string>(that.propertyNames);
      const legacySettings = record as Partial<LegacySettings> & Partial<PluginSettings>;
      converter(legacySettings);
      for (const key of Object.keys(legacySettings)) {
        if (pluginSettingKeys.has(key)) {
          continue;
        }

        if (!legacySettingsKeys.has(key)) {
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- We have no other way to delete the property.
        delete record[key];
      }
    }
  }

  /**
   * Registers a validator for a property.
   *
   * @typeParam PropertyName - The name of the settings property.
   * @param propertyName - The name of the property.
   * @param validator - The validator.
   */
  public registerValidator<PropertyName extends PropertyNames<PluginSettings>>(
    propertyName: PropertyName,
    validator: SettingsValidator<PluginSettings, PropertyName>
  ): void {
    this.validators.set(propertyName, validator as SettingsValidator<PluginSettings>);
  }

  /**
   * Revalidates the settings.
   *
   * @returns The validation messages.
   */
  public async revalidate(): Promise<Record<PropertyNames<PluginSettings>, string>> {
    this.ensureLoaded();
    await this.edit(noop);
    return this.currentState.validationMessages;
  }

  /**
   * Saves the new plugin settings.
   *
   * @param context - The context of the save to file operation.
   * @returns A {@link Promise} that resolves when the settings are saved.
   */
  public async saveToFile(context?: unknown): Promise<void> {
    this.ensureLoaded();
    if (deepEqual(this.lastSavedState.inputValues, this.currentState.inputValues)) {
      return;
    }

    await this.saveToFileImpl();
    await this.asyncEvents.triggerAsync(
      'saveSettings',
      this.currentState as ReadonlyPluginSettingsState<PluginSettings>,
      this.lastSavedState as ReadonlyPluginSettingsState<PluginSettings>,
      context
    );
    this.lastSavedState = await this.cloneState(this.currentState);
  }

  /**
   * Sets the value of a property.
   *
   * @typeParam PropertyName - The name of the property.
   * @param propertyName - The name of the property.
   * @param value - The value to set.
   * @returns A {@link Promise} that resolves to the validation message.
   */
  public async setProperty<PropertyName extends PropertyNames<PluginSettings>>(
    propertyName: PropertyName,
    value: PluginSettings[PropertyName]
  ): Promise<string> {
    this.ensureLoaded();
    await this.edit((settings) => {
      settings[propertyName] = value;
    });
    return this.currentState.validationMessages[propertyName];
  }

  /**
   * Validates the settings.
   *
   * @param settings - The settings.
   * @returns A {@link Promise} that resolves to the validation result.
   */
  public async validate(settings: PluginSettings): Promise<ValidationResult<PluginSettings>> {
    const result: ValidationResult<PluginSettings> = {};
    for (const [propertyName, validator] of this.validators.entries()) {
      const validationMessage = await validator(settings[propertyName], settings);
      if (validationMessage) {
        result[propertyName] = validationMessage;
      }
    }

    return result;
  }

  /**
   * Gets the transformer.
   *
   * @returns The transformer.
   */
  protected getTransformer(): Transformer {
    return defaultTransformer;
  }

  /**
   * Called when the plugin settings record is loaded from disk.
   *
   * @param record - The record.
   */
  protected async onLoadRecord(record: GenericObject): Promise<void> {
    for (const converter of this.legacySettingsConverters) {
      converter(record);
    }
    await noopAsync();
  }

  /**
   * Called when settings are loaded or reloaded.
   *
   * @param _loadedState - The loaded settings state.
   * @param _isInitialLoad - Whether this is the initial load.
   */
  protected async onLoadSettings(
    _loadedState: ReadonlyPluginSettingsState<PluginSettings>,
    _isInitialLoad: boolean
  ): Promise<void> {
    await noopAsync();
  }

  /**
   * Called when settings are saved.
   *
   * @param _newState - The new settings state.
   * @param _oldState - The old settings state.
   * @param _context - The save context.
   */
  protected async onSaveSettings(
    _newState: ReadonlyPluginSettingsState<PluginSettings>,
    _oldState: ReadonlyPluginSettingsState<PluginSettings>,
    _context: unknown
  ): Promise<void> {
    await noopAsync();
  }

  /**
   * Called when the plugin settings record is about to be saved to disk.
   *
   * @param _record - The record.
   */
  protected async onSavingRecord(_record: GenericObject): Promise<void> {
    await noopAsync();
  }

  /**
   * Registers the legacy settings converters.
   * Override to register legacy settings converters.
   */
  protected registerLegacySettingsConverters(): void {
    noop();
  }

  /**
   * Registers the validators.
   * Override to register validators for properties.
   */
  protected registerValidators(): void {
    noop();
  }

  private async cloneSettings(settings: PluginSettings): Promise<PluginSettings> {
    const record = await this.settingsToRawRecord(settings);
    const json = JSON.stringify(record);
    const cloneRecord = JSON.parse(json) as GenericObject;
    return await this.rawRecordToSettings(cloneRecord);
  }

  private async cloneState(
    state: PluginSettingsState<PluginSettings>
  ): Promise<PluginSettingsState<PluginSettings>> {
    return {
      effectiveValues: await this.cloneSettings(state.effectiveValues),
      inputValues: await this.cloneSettings(state.inputValues),
      validationMessages: { ...state.validationMessages }
    };
  }

  private createDefaultState(): PluginSettingsState<PluginSettings> {
    return {
      effectiveValues: new this.pluginSettingsClass(),
      inputValues: new this.pluginSettingsClass(),
      validationMessages: castTo<Record<PropertyNames<PluginSettings>, string>>({})
    };
  }

  private async edit(settingsEditor: (settings: PluginSettings) => Promisable<void>): Promise<void> {
    try {
      await settingsEditor(this.currentState.inputValues);
    } finally {
      const validationResult = await this.validate(this.currentState.inputValues);
      for (const propertyName of this.propertyNames) {
        const validationMessage = validationResult[propertyName] ?? '';
        this.currentState.validationMessages[propertyName] = validationMessage;
        const defaults = this.defaultSettings as PluginSettings;
        this.currentState.effectiveValues[propertyName] = validationMessage
          ? defaults[propertyName]
          : this.currentState.inputValues[propertyName];
      }
    }
  }

  private isValidPropertyName(prop: unknown): prop is PropertyNames<PluginSettings> {
    if (typeof prop !== 'string') {
      return false;
    }

    return (this.propertyNames as string[]).includes(prop);
  }

  private async rawRecordToSettings(rawRecord: GenericObject): Promise<PluginSettings> {
    rawRecord = this.getTransformer().transformObjectRecursively(rawRecord);
    await this.onLoadRecord(rawRecord);

    const settings = new this.pluginSettingsClass();
    const defaults = this.defaultSettings as PluginSettings;

    for (const [propertyName, value] of Object.entries(rawRecord)) {
      if (!this.isValidPropertyName(propertyName)) {
        getLibDebugger('PluginSettingsComponentBase:rawRecordToSettings')(`Unknown property: ${propertyName}`);
        continue;
      }

      if (typeof value !== typeof defaults[propertyName]) {
        getLibDebugger('PluginSettingsComponentBase:rawRecordToSettings')(
          'Possible invalid value type. It might lead to an unexpected behavior of the plugin. There is also a chance it is a false-negative warning, as we are unable to determine the exact type of the value in runtime.',
          {
            defaultValue: defaults[propertyName],
            propertyName,
            value
          }
        );
      }

      settings[propertyName] = value as PropertyValues<PluginSettings>;
    }

    return settings;
  }

  private async saveToFileImpl(): Promise<void> {
    await this.dataHandler.saveData(await this.settingsToRawRecord(this.currentState.inputValues));
  }

  private setPropertyImpl(
    propertyName: PropertyNames<PluginSettings>,
    value: PropertyValues<PluginSettings>,
    validationMessage?: string
  ): void {
    const defaults = this.defaultSettings as PluginSettings;
    this.currentState.inputValues[propertyName] = value;
    this.currentState.validationMessages[propertyName] = validationMessage ?? '';
    this.currentState.effectiveValues[propertyName] = validationMessage ? defaults[propertyName] : value;
  }

  private async settingsToRawRecord(settings: PluginSettings): Promise<GenericObject> {
    const rawRecord: GenericObject = {};

    for (const propertyName of this.propertyNames) {
      rawRecord[propertyName] = settings[propertyName];
    }

    await this.onSavingRecord(rawRecord);

    return this.getTransformer().transformObjectRecursively(rawRecord);
  }
}
