/**
 * @packageDocumentation PluginSettingsTabBase
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import type {
  ConditionalKeys,
  Promisable
} from 'type-fest';

import { PluginSettingTab } from 'obsidian';

import type { StringKeys } from '../../Object.ts';
import type { ValueComponentWithChangeTracking } from '../Components/ValueComponentWithChangeTracking.ts';
import type { ValidationMessageHolder } from '../ValidationMessage.ts';
import type { PluginBase } from './PluginBase.ts';
import type { PluginSettingsProperty } from './PluginSettingsManagerBase.ts';

import { invokeAsyncSafely } from '../../Async.ts';
import { CssClass } from '../../CssClass.ts';
import { noop } from '../../Function.ts';
import { isPlaceholderComponent } from '../Components/PlaceholderComponent.ts';
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
   * If true, shows the validation message when the component value is invalid. Default is `true`.
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
   * @param uiValue - The value of the UI component.
   * @returns The value to set on the plugin settings.
   */
  componentToPluginSettingsValueConverter: (uiValue: UIValue) => PluginSettings[PropertyName] | ValidationMessageHolder;

  /**
   * Converts the plugin settings value to the value used by the UI component.
   * @param pluginSettingsValue - The value of the property in the plugin settings.
   * @returns The value to set on the UI component.
   */
  pluginSettingsToComponentValueConverter: (pluginSettingsValue: PluginSettings[PropertyName]) => UIValue;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractPluginSettings<Plugin extends PluginBase<any>> = Plugin extends PluginBase<infer PluginSettings> ? PluginSettings : never;

/**
 * Base class for creating plugin settings tabs in Obsidian.
 * Provides a method for binding value components to plugin settings and handling changes.
 *
 * @typeParam TPlugin - The type of the plugin that extends PluginBase.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class PluginSettingsTabBase<TPlugin extends PluginBase<any>> extends PluginSettingTab {
  public constructor(public override plugin: TPlugin) {
    super(plugin.app, plugin);
    this.containerEl.addClass(CssClass.LibraryName, getPluginId(), CssClass.PluginSettingsTab);
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
    propertyName: ConditionalKeys<ExtractPluginSettings<TPlugin>, UIValue>,
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
    PropertyName extends StringKeys<ExtractPluginSettings<TPlugin>>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    propertyName: PropertyName,
    options: BindOptionsExtended<ExtractPluginSettings<TPlugin>, UIValue, PropertyName>
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
    PropertyName extends StringKeys<ExtractPluginSettings<TPlugin>>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    propertyName: PropertyName,
    options?: BindOptions<ExtractPluginSettings<TPlugin>[PropertyName]>
  ): TValueComponent {
    type PluginSettings = ExtractPluginSettings<TPlugin>;
    type PropertyType = PluginSettings[PropertyName];
    const DEFAULT_OPTIONS: Required<BindOptionsExtended<PluginSettings, UIValue, PropertyName>> = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      componentToPluginSettingsValueConverter: (value: UIValue): PropertyType => value as PropertyType,
      onChanged: noop,
      pluginSettingsToComponentValueConverter: (value: PropertyType): UIValue => value as UIValue,
      shouldShowValidationMessage: true
    };

    const optionsExt: Required<BindOptionsExtended<PluginSettings, UIValue, PropertyName>> = { ...DEFAULT_OPTIONS, ...options };

    const validatorElement = getValidatorComponent(valueComponent)?.validatorEl;

    const property = this.plugin.settingsManager.getProperty(propertyName) as PluginSettingsProperty<PropertyType>;

    let value = property.getModifiedValue();

    if (value === undefined && !isPlaceholderComponent(valueComponent)) {
      value = property.defaultValue;
      property.setValue(value);
    }

    if (value !== undefined) {
      valueComponent.setValue(optionsExt.pluginSettingsToComponentValueConverter(value));
    }

    valueComponent.onChange(async (uiValue) => {
      const oldValue = property.getModifiedOrDefaultValue();
      const convertedValue = optionsExt.componentToPluginSettingsValueConverter(uiValue);
      if (isValidationMessageHolder(convertedValue)) {
        property.setValidationMessage(convertedValue.validationMessage);
      } else {
        await property.setValueAndValidate(convertedValue);
      }
      const newValue = isValidationMessageHolder(convertedValue) ? undefined : convertedValue;
      await optionsExt.onChanged(newValue, oldValue);
    });

    if (isPlaceholderComponent(valueComponent)) {
      valueComponent.setPlaceholder(optionsExt.pluginSettingsToComponentValueConverter(property.defaultValue) as string);
    }

    validatorElement?.addEventListener('focus', validate);
    validatorElement?.addEventListener('blur', validate);

    validate();
    return valueComponent;

    function validate(): void {
      if (!validatorElement) {
        return;
      }

      if (!property.validationMessage) {
        validatorElement.setCustomValidity('');
        validatorElement.checkValidity();
        property.setValidationMessage(validatorElement.validationMessage);
      }

      validatorElement.setCustomValidity(property.validationMessage);
      validatorElement.title = property.validationMessage;
      if (validatorElement.isActiveElement() && optionsExt.shouldShowValidationMessage) {
        validatorElement.reportValidity();
      }
    }
  }

  public override hide(): void {
    super.hide();
    invokeAsyncSafely(() => this.plugin.settingsManager.saveToFile());
  }
}
