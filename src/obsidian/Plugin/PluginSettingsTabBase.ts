/**
 * @packageDocumentation
 *
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import type { Debouncer } from 'obsidian';
import type {
  ConditionalKeys,
  Promisable,
  ReadonlyDeep
} from 'type-fest';

import {
  debounce,
  PluginSettingTab,
  setTooltip
} from 'obsidian';

import type { AsyncEventRef } from '../../AsyncEvents.ts';
import type { StringKeys } from '../../Type.ts';
import type { ValueComponentWithChangeTracking } from '../Components/SettingComponents/ValueComponentWithChangeTracking.ts';
import type { ValidationMessageHolder } from '../ValidationMessage.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { PluginSettingsManagerBase } from './PluginSettingsManagerBase.ts';
import type {
  ExtractPlugin,
  ExtractPluginSettings,
  ExtractReadonlyPluginSettingsWrapper,
  PluginTypesBase
} from './PluginTypesBase.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../Async.ts';
import { AsyncEvents } from '../../AsyncEvents.ts';
import { CssClass } from '../../CssClass.ts';
import {
  noop,
  noopAsync
} from '../../Function.ts';
import { deepEqual } from '../../Object.ts';
import { AsyncEventsComponent } from '../Components/AsyncEventsComponent.ts';
import { ensureWrapped } from '../Components/SettingComponents/SettingComponentWrapper.ts';
import { getTextBasedComponentValue } from '../Components/SettingComponents/TextBasedComponent.ts';
import { getValidatorComponent } from '../Components/SettingComponents/ValidatorComponent.ts';
import { isValidationMessageHolder } from '../ValidationMessage.ts';
import { addPluginCssClasses } from './PluginContext.ts';

/**
 * The context passed to the {@link PluginSettingsManagerBase.saveToFile} method.
 */
export const SAVE_TO_FILE_CONTEXT = 'PluginSettingsTab';

/**
 * Options for binding a value component to a plugin setting.
 */
export interface BindOptions<T> {
  /**
   * A callback function that is called when the value of the component changes.
   */
  onChanged?(newValue: ReadonlyDeep<T>, oldValue: ReadonlyDeep<T>): Promisable<void>;

  /**
   * Whether to reset the setting when the component value is empty. Default is `true`.
   * Applicable only to text-based components.
   */
  shouldResetSettingWhenComponentIsEmpty?: boolean;

  /**
   * Whether to show the placeholder for default values. Default is `true`.
   * Applicable only to text-based components.
   */
  shouldShowPlaceholderForDefaultValues?: boolean;

  /**
   * Whether to show the validation message when the component value is invalid. Default is `true`.
   */
  shouldShowValidationMessage?: boolean;
}

/**
 * Extended options for binding a value component to a plugin setting.
 */
export interface BindOptionsExtended<
  PluginSettings extends object,
  UIValue,
  PropertyName extends StringKeys<PluginSettings>
> extends BindOptions<PluginSettings[PropertyName]> {
  /**
   * Converts the UI component's value back to the plugin settings value.
   *
   * @param uiValue - The value of the UI component.
   * @returns The value to set on the plugin settings.
   */
  componentToPluginSettingsValueConverter: (uiValue: UIValue) => PluginSettings[PropertyName] | ValidationMessageHolder;

  /**
   * Converts the plugin settings value to the value used by the UI component.
   *
   * @param pluginSettingsValue - The value of the property in the plugin settings.
   * @returns The value to set on the UI component.
   */
  pluginSettingsToComponentValueConverter: (pluginSettingsValue: ReadonlyDeep<PluginSettings[PropertyName]>) => UIValue;
}

/**
 * Base class for creating plugin settings tabs in Obsidian.
 * Provides a method for binding value components to plugin settings and handling changes.
 *
 * @typeParam PluginTypes - Plugin-specific types.
 */
export abstract class PluginSettingsTabBase<PluginTypes extends PluginTypesBase> extends PluginSettingTab {
  /**
   * Whether the plugin settings tab is open.
   *
   * @returns Whether the plugin settings tab is open.
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * The debounce timeout for saving settings.
   *
   * @returns The debounce timeout for saving settings.
   */
  protected get saveSettingsDebounceTimeoutInMilliseconds(): number {
    const DEFAULT = 2_000;
    return DEFAULT;
  }

  private _isOpen = false;
  private readonly asyncEvents: AsyncEvents;
  private readonly asyncEventsComponent: AsyncEventsComponent;
  private saveSettingsDebounced: Debouncer<[], void>;

  private get pluginSettings(): ExtractPluginSettings<PluginTypes> {
    return this.plugin.settingsManager.settingsWrapper.settings as ExtractPluginSettings<PluginTypes>;
  }

  /**
   * Creates a new plugin settings tab.
   *
   * @param plugin - The plugin.
   */
  public constructor(public override plugin: ExtractPlugin<PluginTypes>) {
    super(plugin.app, plugin);
    addPluginCssClasses(this.containerEl, CssClass.PluginSettingsTab);
    this.saveSettingsDebounced = debounce(
      convertAsyncToSync(() => this.plugin.settingsManager.saveToFile(SAVE_TO_FILE_CONTEXT)),
      this.saveSettingsDebounceTimeoutInMilliseconds
    );
    this.asyncEventsComponent = new AsyncEventsComponent();
    this.asyncEvents = new AsyncEvents();
  }

  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @param valueComponent - The value component to bind.
   * @param propertyName - The property of the plugin settings to bind to.
   * @param options - The options for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    propertyName: ConditionalKeys<ExtractPluginSettings<PluginTypes>, UIValue>,
    options?: BindOptions<UIValue>
  ): TValueComponent;
  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @typeParam PropertyName - The property name of the plugin settings to bind to.
   * @param valueComponent - The value component to bind.
   * @param propertyName - The property name of the plugin settings to bind to.
   * @param options - The options for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent,
    PropertyName extends StringKeys<ExtractPluginSettings<PluginTypes>>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    propertyName: PropertyName,
    options: BindOptionsExtended<ExtractPluginSettings<PluginTypes>, UIValue, PropertyName>
  ): TValueComponent;
  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @typeParam PropertyName - The property name of the plugin settings to bind to.
   * @param valueComponent - The value component to bind.
   * @param propertyName - The property name of the plugin settings to bind to.
   * @param options - The options for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent,
    PropertyName extends StringKeys<ExtractPluginSettings<PluginTypes>>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    propertyName: PropertyName,
    options?: BindOptions<ExtractPluginSettings<PluginTypes>[PropertyName]>
  ): TValueComponent {
    type PluginSettings = ExtractPluginSettings<PluginTypes>;
    type PropertyType = PluginSettings[PropertyName];
    const DEFAULT_OPTIONS: Required<BindOptionsExtended<PluginSettings, UIValue, PropertyName>> = {
      componentToPluginSettingsValueConverter: (value: UIValue): PropertyType => value as PropertyType,
      onChanged: noop,
      pluginSettingsToComponentValueConverter: (value: ReadonlyDeep<PropertyType>): UIValue => value as UIValue,
      shouldResetSettingWhenComponentIsEmpty: true,
      shouldShowPlaceholderForDefaultValues: true,
      shouldShowValidationMessage: true
    };

    const optionsExt: Required<BindOptionsExtended<PluginSettings, UIValue, PropertyName>> = { ...DEFAULT_OPTIONS, ...options };

    const validatorEl = getValidatorComponent(valueComponent)?.validatorEl;

    const textBasedComponent = getTextBasedComponentValue(valueComponent);

    const readonlyValue = this.pluginSettings[propertyName] as ReadonlyDeep<PropertyType>;
    const defaultValue = (this.plugin.settingsManager.defaultSettings as PluginSettings)[propertyName] as PropertyType;
    textBasedComponent?.setPlaceholderValue(optionsExt.pluginSettingsToComponentValueConverter(defaultValue as ReadonlyDeep<PropertyType>));

    let validationMessage: string;
    let tooltipEl: HTMLElement | null = null;
    let tooltipContentEl: HTMLElement | null = null;
    if (validatorEl) {
      const wrapper = ensureWrapped(validatorEl);
      tooltipEl = wrapper.createDiv();
      addPluginCssClasses(tooltipEl, CssClass.Tooltip, CssClass.TooltipValidator);
      tooltipContentEl = tooltipEl.createSpan();
      const tooltipArrowEl = tooltipEl.createDiv();
      addPluginCssClasses(tooltipArrowEl, CssClass.TooltipArrow);
      tooltipEl.hide();
      wrapper.appendChild(tooltipEl);
    }

    this.asyncEventsComponent.registerAsyncEvent(this.on('validationMessageChanged', (anotherPropertyName, anotherValidationMessage) => {
      if (propertyName !== anotherPropertyName) {
        return;
      }

      validationMessage = anotherValidationMessage;
      updateValidatorElDebounced();
    }));

    let shouldEmptyOnBlur = false;

    if (textBasedComponent && optionsExt.shouldShowPlaceholderForDefaultValues && deepEqual(readonlyValue, defaultValue)) {
      textBasedComponent.empty();
    } else {
      valueComponent.setValue(optionsExt.pluginSettingsToComponentValueConverter(readonlyValue));
    }

    let shouldSkipOnChange = false;
    const UPDATE_VALIDATOR_EL_TIMEOUT_IN_MILLISECONDS = 100;
    const updateValidatorElDebounced = debounce(() => {
      requestAnimationFrame(() => {
        updateValidatorEl();
      });
    }, UPDATE_VALIDATOR_EL_TIMEOUT_IN_MILLISECONDS);

    valueComponent.onChange(async (uiValue) => {
      if (shouldSkipOnChange) {
        shouldSkipOnChange = false;
        return;
      }

      shouldEmptyOnBlur = false;

      const oldValue = this.pluginSettings[propertyName];
      let newValue: PropertyType | undefined = undefined;
      let shouldSetProperty = true;
      if (textBasedComponent?.isEmpty() && optionsExt.shouldResetSettingWhenComponentIsEmpty) {
        newValue = defaultValue;
      } else {
        const convertedValue = optionsExt.componentToPluginSettingsValueConverter(uiValue);
        if (isValidationMessageHolder(convertedValue)) {
          validationMessage = convertedValue.validationMessage;
          shouldSetProperty = false;
        } else {
          newValue = convertedValue;
        }
      }

      if (shouldSetProperty) {
        validationMessage = await this.plugin.settingsManager.setProperty(propertyName, newValue);
        if (textBasedComponent && optionsExt.shouldShowPlaceholderForDefaultValues && !textBasedComponent.isEmpty() && deepEqual(newValue, defaultValue)) {
          shouldEmptyOnBlur = true;
        }
      }

      updateValidatorElDebounced();
      if (newValue !== undefined) {
        await optionsExt.onChanged(newValue as ReadonlyDeep<PropertyType>, oldValue as ReadonlyDeep<PropertyType>);
      }
      this.saveSettingsDebounced();
    });

    validatorEl?.addEventListener('focus', () => {
      updateValidatorElDebounced();
    });
    validatorEl?.addEventListener('blur', () => {
      updateValidatorElDebounced();
    });
    validatorEl?.addEventListener('click', () => {
      requestAnimationFrame(() => {
        updateValidatorElDebounced();
      });
    });

    validationMessage = this.plugin.settingsManager.settingsWrapper.validationMessages[propertyName] ?? '';
    updateValidatorElDebounced();

    return valueComponent;

    function updateValidatorEl(): void {
      if (shouldEmptyOnBlur && !validatorEl?.isActiveElement()) {
        shouldEmptyOnBlur = false;
        if (!textBasedComponent?.isEmpty()) {
          shouldSkipOnChange = true;
          textBasedComponent?.empty();
        }
      }

      if (!validatorEl) {
        return;
      }

      if (validationMessage === '') {
        validatorEl.setCustomValidity('');
        validatorEl.checkValidity();
        validationMessage = validatorEl.validationMessage;
      }

      validatorEl.setCustomValidity(validationMessage);
      if (optionsExt.shouldShowValidationMessage) {
        if (tooltipContentEl) {
          tooltipContentEl.textContent = validationMessage;
        }
        tooltipEl?.toggle(!!validationMessage);
      } else if (validationMessage) {
        setTooltip(validatorEl, validationMessage);
      }
    }
  }

  /**
   * Renders the plugin settings tab.
   */
  public override display(): void {
    this.containerEl.empty();
    this._isOpen = true;
    this.asyncEventsComponent.load();
    this.asyncEventsComponent.registerAsyncEvent(this.plugin.settingsManager.on('loadSettings', this.onLoadSettings.bind(this)));
    this.asyncEventsComponent.registerAsyncEvent(this.plugin.settingsManager.on('saveSettings', this.onSaveSettings.bind(this)));
  }

  /**
   * Hides the plugin settings tab.
   */
  public override hide(): void {
    super.hide();
    this.saveSettingsDebounced.cancel();
    this._isOpen = false;
    this.asyncEventsComponent.unload();
    this.asyncEventsComponent.load();
    invokeAsyncSafely(() => this.plugin.settingsManager.saveToFile(SAVE_TO_FILE_CONTEXT));
  }

  /**
   * Shows the plugin settings tab.
   */
  public show(): void {
    this.app.setting.openTab(this);
  }

  /**
   * Called when the plugin settings are loaded.
   *
   * @param _loadedSettings - The loaded settings.
   * @param _isInitialLoad - Whether the settings are being loaded for the first time.
   * @returns A {@link Promise} that resolves when the settings are loaded.
   */
  protected async onLoadSettings(_loadedSettings: ExtractReadonlyPluginSettingsWrapper<PluginTypes>, _isInitialLoad: boolean): Promise<void> {
    this.refresh();
    await noopAsync();
  }

  private on(
    name: 'validationMessageChanged',
    callback: (
      propertyName: string,
      validationMessage: string
    ) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef;
  private on<Args extends unknown[]>(
    name: string,
    callback: (...args: Args) => Promisable<void>,
    thisArg?: unknown
  ): AsyncEventRef {
    return this.asyncEvents.on(name, callback, thisArg);
  }

  private async onSaveSettings(
    newSettings: ExtractReadonlyPluginSettingsWrapper<PluginTypes>,
    _oldSettings: ExtractReadonlyPluginSettingsWrapper<PluginTypes>,
    context: unknown
  ): Promise<void> {
    if (context === SAVE_TO_FILE_CONTEXT) {
      for (const [propertyName, validationMessage] of Object.entries(newSettings.validationMessages as Record<string, string>)) {
        await this.asyncEvents.triggerAsync('validationMessageChanged', propertyName, validationMessage);
      }
      return;
    }

    this.refresh();
  }

  private refresh(): void {
    this.containerEl.empty();
    this.display();
  }
}
