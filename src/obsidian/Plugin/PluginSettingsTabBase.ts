/**
 * @packageDocumentation
 *
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import type { Debouncer } from 'obsidian';
import type {
  ConditionalKeys,
  Promisable
} from 'type-fest';

import {
  debounce,
  PluginSettingTab,
  setTooltip
} from 'obsidian';

import type { StringKeys } from '../../Type.ts';
import type { ValueComponentWithChangeTracking } from '../Components/ValueComponentWithChangeTracking.ts';
import type { ValidationMessageHolder } from '../ValidationMessage.ts';
import type { PluginSettingsProperty } from './PluginSettingsManagerBase.ts';
import type {
  ExtractPlugin,
  ExtractPluginSettings,
  PluginTypesBase
} from './PluginTypesBase.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../Async.ts';
import { CssClass } from '../../CssClass.ts';
import { noop } from '../../Function.ts';
import { getTextBasedComponentValue } from '../Components/TextBasedComponent.ts';
import { getValidatorComponent } from '../Components/ValidatorComponent.ts';
import { isValidationMessageHolder } from '../ValidationMessage.ts';
import { getPluginId } from './PluginId.ts';

/**
 * Options for binding a value component to a plugin setting.
 */
export interface BindOptions<T> {
  /**
   * A callback function that is called when the value of the component changes.
   */
  onChanged?(newValue: T | undefined, oldValue: T): Promisable<void>;

  /**
   * Whether to reset the setting when the component value is empty. Default is `true`.
   * Applicable only to text-based components.
   */
  shouldResetSettingWhenComponentIsEmpty?: boolean;

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
  pluginSettingsToComponentValueConverter: (pluginSettingsValue: PluginSettings[PropertyName]) => UIValue;
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

  private saveSettingsDebounced: Debouncer<[], void>;

  /**
   * Creates a new plugin settings tab.
   *
   * @param plugin - The plugin.
   */
  public constructor(public override plugin: ExtractPlugin<PluginTypes>) {
    super(plugin.app, plugin);
    this.containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.PluginSettingsTab);
    this.saveSettingsDebounced = debounce(convertAsyncToSync(() => this.plugin.settingsManager.saveToFile()), this.saveSettingsDebounceTimeoutInMilliseconds);
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
      pluginSettingsToComponentValueConverter: (value: PropertyType): UIValue => value as UIValue,
      shouldResetSettingWhenComponentIsEmpty: true,
      shouldShowValidationMessage: true
    };

    const optionsExt: Required<BindOptionsExtended<PluginSettings, UIValue, PropertyName>> = { ...DEFAULT_OPTIONS, ...options };

    const validatorElement = getValidatorComponent(valueComponent)?.validatorEl;

    const property = this.plugin.settingsManager.getProperty(propertyName) as PluginSettingsProperty<PluginSettings, PropertyName>;

    const value = property.currentValue;

    const textBasedComponent = getTextBasedComponentValue(valueComponent);
    textBasedComponent?.setPlaceholderValue(optionsExt.pluginSettingsToComponentValueConverter(property.defaultValue));

    if (property.currentValue === property.defaultValue && textBasedComponent && optionsExt.shouldResetSettingWhenComponentIsEmpty) {
      textBasedComponent.empty();
    } else {
      valueComponent.setValue(optionsExt.pluginSettingsToComponentValueConverter(value));
    }

    valueComponent.onChange(async (uiValue) => {
      const oldValue = property.currentValue;
      let newValue: PropertyType | undefined = undefined;
      if (textBasedComponent?.isEmpty() && optionsExt.shouldResetSettingWhenComponentIsEmpty) {
        property.reset();
        newValue = property.defaultValue;
      } else {
        const convertedValue = optionsExt.componentToPluginSettingsValueConverter(uiValue);
        if (isValidationMessageHolder(convertedValue)) {
          property.setValidationMessage(convertedValue.validationMessage);
        } else {
          property.setValue(convertedValue);
          await property.validate();
          newValue = convertedValue;
        }
      }
      updateValidatorElement();
      if (newValue !== undefined) {
        await optionsExt.onChanged(newValue, oldValue);
      }
      this.saveSettingsDebounced();
    });

    validatorElement?.addEventListener('focus', updateValidatorElement);
    validatorElement?.addEventListener('blur', updateValidatorElement);

    updateValidatorElement();
    return valueComponent;

    function updateValidatorElement(): void {
      if (!validatorElement) {
        return;
      }

      if (!property.validationMessage) {
        validatorElement.setCustomValidity('');
        validatorElement.checkValidity();
        property.setValidationMessage(validatorElement.validationMessage);
      }

      validatorElement.setCustomValidity(property.validationMessage);
      setTooltip(validatorElement, property.validationMessage);
      if (validatorElement.isActiveElement() && optionsExt.shouldShowValidationMessage) {
        validatorElement.reportValidity();
      }
    }
  }

  /**
   * Renders the plugin settings tab.
   */
  public override display(): void {
    this._isOpen = true;
  }

  /**
   * Hides the plugin settings tab.
   */
  public override hide(): void {
    super.hide();
    this._isOpen = false;
    this.saveSettingsDebounced.cancel();
    invokeAsyncSafely(() => this.plugin.settingsManager.saveToFile());
  }

  /**
   * Shows the plugin settings tab.
   */
  public show(): void {
    this.app.setting.openTab(this);
  }
}
