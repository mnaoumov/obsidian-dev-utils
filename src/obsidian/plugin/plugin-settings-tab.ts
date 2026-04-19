/**
 * @file
 *
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import type {
  Debouncer,
  Plugin
} from 'obsidian';
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

import type { AsyncEventRef } from '../../async-events.ts';
import type { StringKeys } from '../../type.ts';
import type { ValueComponentWithChangeTracking } from '../components/setting-components/value-component-with-change-tracking.ts';
import type { ValidationMessageHolder } from '../validation.ts';
import type {
  PluginSettingsComponentBase,
  ReadonlyPluginSettingsState
} from './components/plugin-settings-component.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../async.ts';
import { CssClass } from '../../css-class.ts';
import {
  noop,
  noopAsync
} from '../../function.ts';
import { deepEqual } from '../../object-utils.ts';
import { AsyncEventsComponent } from '../components/async-events-component.ts';
import { ensureWrapped } from '../components/setting-components/setting-component-wrapper.ts';
import { getTextBasedComponentValue } from '../components/setting-components/text-based-component.ts';
import { getValidatorComponent } from '../components/setting-components/validator-component.ts';
import { isValidationMessageHolder } from '../validation.ts';
import { addPluginCssClasses } from './plugin-context.ts';

/**
 * A context passed to the {@link PluginSettingsComponentBase.saveToFile} method.
 */
export const SAVE_TO_FILE_CONTEXT = 'PluginSettingsTab';

/**
 * Options for `PluginSettingsTabBase.bind`.
 */
export interface BindOptions<T> {
  /**
   * A callback function that is called when the value of the component changes.
   */
  readonly onChanged?: (newValue: ReadonlyDeep<T>, oldValue: ReadonlyDeep<T>) => Promisable<void>;

  /**
   * Whether to reset the setting when the component value is empty. Default is `true`.
   * Applicable only to text-based components.
   */
  readonly shouldResetSettingWhenComponentIsEmpty?: boolean;

  /**
   * Whether to show the placeholder for default values. Default is `true`.
   * Applicable only to text-based components.
   */
  readonly shouldShowPlaceholderForDefaultValues?: boolean;

  /**
   * Whether to show the validation message when the component value is invalid. Default is `true`.
   */
  readonly shouldShowValidationMessage?: boolean;
}

/**
 * Extended options for `PluginSettingsTabBase.bind`.
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
  readonly componentToPluginSettingsValueConverter: (uiValue: UIValue) => PluginSettings[PropertyName] | ValidationMessageHolder;

  /**
   * Converts the plugin settings value to the value used by the UI component.
   *
   * @param pluginSettingsValue - The value of the property in the plugin settings.
   * @returns The value to set on the UI component.
   */
  readonly pluginSettingsToComponentValueConverter: (pluginSettingsValue: ReadonlyDeep<PluginSettings[PropertyName]>) => UIValue;
}

/**
 * Params for creating a {@link PluginSettingsTabBase}.
 */
export interface PluginSettingsTabBaseParams<PluginSettings extends object> {
  /**
   * The plugin instance (needed by Obsidian's PluginSettingTab).
   */
  readonly plugin: Plugin;

  /**
   * The settings component.
   */
  readonly settingsComponent: PluginSettingsComponentBase<PluginSettings>;
}

/**
 * Base class for creating plugin settings tabs in Obsidian.
 * Provides a method for binding value components to plugin settings and handling changes.
 *
 * @typeParam PluginSettings - The plugin settings type.
 */
export abstract class PluginSettingsTabBase<PluginSettings extends object> extends PluginSettingTab {
  /**
   * Whether the plugin settings tab is open.
   *
   * @returns Whether the plugin settings tab is open.
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * The settings manager.
   */
  protected readonly settingsComponent: PluginSettingsComponentBase<PluginSettings>;

  /**
   * A debounce timeout for saving settings.
   *
   * @returns The debounce timeout for saving settings.
   */
  protected get saveSettingsDebounceTimeoutInMilliseconds(): number {
    const DEFAULT = 2_000;
    return DEFAULT;
  }

  private _isOpen = false;
  private readonly asyncEventsComponent: AsyncEventsComponent;
  private readonly saveSettingsDebounced: Debouncer<[], void>;

  private get pluginSettings(): PluginSettings {
    return this.settingsComponent.settingsState.inputValues as PluginSettings;
  }

  /**
   * Creates a new plugin settings tab.
   *
   * @param params - The params.
   */
  public constructor(params: PluginSettingsTabBaseParams<PluginSettings>) {
    super(params.plugin.app, params.plugin);
    this.settingsComponent = params.settingsComponent;
    addPluginCssClasses(this.containerEl, CssClass.PluginSettingsTab);
    this.saveSettingsDebounced = debounce(
      convertAsyncToSync(() => this.settingsComponent.saveToFile(SAVE_TO_FILE_CONTEXT)),
      this.saveSettingsDebounceTimeoutInMilliseconds
    );
    this.asyncEventsComponent = new AsyncEventsComponent();
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
    propertyName: ConditionalKeys<PluginSettings, UIValue>,
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
    PropertyName extends StringKeys<PluginSettings>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    propertyName: PropertyName,
    options: BindOptionsExtended<PluginSettings, UIValue, PropertyName>
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
    PropertyName extends StringKeys<PluginSettings>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    propertyName: PropertyName,
    options?: BindOptions<PluginSettings[PropertyName]>
  ): TValueComponent {
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
    const defaults = this.settingsComponent.defaultSettings as PluginSettings;
    const defaultValue = defaults[propertyName] as PropertyType;
    const defaultComponentValue = optionsExt.pluginSettingsToComponentValueConverter(defaultValue as ReadonlyDeep<PropertyType>);
    textBasedComponent?.setPlaceholderValue(defaultComponentValue);

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
    let shouldRevertToDefaultValueOnBlur = false;

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
      shouldRevertToDefaultValueOnBlur = !!textBasedComponent?.isEmpty() && optionsExt.shouldResetSettingWhenComponentIsEmpty;
      if (shouldRevertToDefaultValueOnBlur) {
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
        validationMessage = await this.settingsComponent.setProperty(propertyName, newValue as PluginSettings[PropertyName]);
        if (textBasedComponent && optionsExt.shouldShowPlaceholderForDefaultValues && !textBasedComponent.isEmpty() && deepEqual(newValue, defaultValue)) {
          shouldEmptyOnBlur = true;
        }
      }

      updateValidatorElDebounced();
      if (shouldSetProperty) {
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

    const validationMessages = this.settingsComponent.settingsState.validationMessages as Record<string, string>;
    validationMessage = validationMessages[propertyName] ?? '';
    updateValidatorElDebounced();

    return valueComponent;

    function updateValidatorEl(): void {
      if (!validatorEl?.isActiveElement()) {
        if (shouldEmptyOnBlur) {
          shouldEmptyOnBlur = false;

          if (!textBasedComponent?.isEmpty()) {
            shouldSkipOnChange = true;
            textBasedComponent?.empty();
          }
        } else if (shouldRevertToDefaultValueOnBlur) {
          shouldRevertToDefaultValueOnBlur = false;

          if (textBasedComponent?.isEmpty()) {
            shouldSkipOnChange = true;
            valueComponent.setValue(defaultComponentValue);
          }
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
        /* v8 ignore start -- tooltipContentEl is always non-null when validatorEl is non-null, both are set in the same block. */
        if (tooltipContentEl) {
          /* v8 ignore stop */
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
    this.asyncEventsComponent.registerAsyncEvent(this.settingsComponent.on('loadSettings', this.onLoadSettings.bind(this)));
    this.asyncEventsComponent.registerAsyncEvent(this.settingsComponent.on('saveSettings', this.onSaveSettings.bind(this)));
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
    invokeAsyncSafely(() => this.hideAsync());
  }

  /**
   * Async actions to perform when the settings tab is being hidden.
   *
   * @returns A {@link Promise} that resolves when the settings tab is hidden.
   */
  public async hideAsync(): Promise<void> {
    await this.settingsComponent.saveToFile(SAVE_TO_FILE_CONTEXT);
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
   * @param _loadedState - The loaded settings state.
   * @param _isInitialLoad - Whether the settings are being loaded for the first time.
   * @returns A {@link Promise} that resolves when the settings are loaded.
   */
  protected async onLoadSettings(_loadedState: ReadonlyPluginSettingsState<PluginSettings>, _isInitialLoad: boolean): Promise<void> {
    this.display();
    await noopAsync();
  }

  /**
   * Revalidates the settings.
   *
   * @returns A {@link Promise} that resolves when the settings are revalidated.
   */
  protected async revalidate(): Promise<void> {
    const validationMessages = await this.settingsComponent.revalidate();
    await this.updateValidations(validationMessages);
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
    return this.asyncEventsComponent.asyncEvents.on(name, callback, thisArg);
  }

  private async onSaveSettings(
    newState: ReadonlyPluginSettingsState<PluginSettings>,
    _oldState: ReadonlyPluginSettingsState<PluginSettings>,
    context: unknown
  ): Promise<void> {
    if (context === SAVE_TO_FILE_CONTEXT) {
      await this.updateValidations(newState.validationMessages as Record<StringKeys<PluginSettings>, string>);
      return;
    }

    this.display();
  }

  private async updateValidations(validationMessages: Record<StringKeys<PluginSettings>, string>): Promise<void> {
    for (const [propertyName, validationMessage] of Object.entries(validationMessages)) {
      await this.asyncEventsComponent.asyncEvents.triggerAsync('validationMessageChanged', propertyName, validationMessage);
    }
  }
}
