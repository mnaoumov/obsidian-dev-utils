/**
 * @packageDocumentation PluginSettingsTabBase
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import type {
  ConditionalKeys,
  Promisable,
  WritableDeep
} from 'type-fest';

import { PluginSettingTab } from 'obsidian';

import type { StringKeys } from '../../Object.ts';
import type { ValueComponentWithChangeTracking } from '../Components/ValueComponentWithChangeTracking.ts';
import type { PluginBase } from './PluginBase.ts';

import { invokeAsyncSafely } from '../../Async.ts';
import { CssClass } from '../../CssClass.ts';
import { noop } from '../../Function.ts';
import { getValidatorComponent } from '../Components/ValidatorComponent.ts';
import { getPluginId } from './PluginId.ts';

/**
 * Options for binding a value component to a plugin setting.
 */
export interface BindOptions {
  /**
   * A callback function that is called when the value of the component changes.
   */
  onChanged?(): Promisable<void>;

  /**
   * If true, shows the validation message when the component value is invalid. Default is `true`.
   */
  shouldShowValidationMessage?: boolean;
}

/**
 * Extended options for binding a value component to a plugin setting.
 */
export interface BindOptionsExtended<PluginSettings extends object, UIValue, Property extends StringKeys<PluginSettings>> extends BindOptions {
  /**
   * Converts the UI component's value back to the plugin settings value.
   * @param uiValue - The value of the UI component.
   * @returns The value to set on the plugin settings.
   */
  componentToPluginSettingsValueConverter: (uiValue: UIValue) => PluginSettings[Property] | ValidationMessageHolder;

  /**
   * Converts the plugin settings value to the value used by the UI component.
   * @param pluginSettingsValue - The value of the property in the plugin settings.
   * @returns The value to set on the UI component.
   */
  pluginSettingsToComponentValueConverter: (pluginSettingsValue: PluginSettings[Property]) => UIValue;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractPluginSettings<T extends PluginBase<any>> = WritableDeep<T['settings']>;

interface ValidationMessageHolder {
  validationMessage: string;
}

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
   * @param property - The property of the plugin settings to bind to.
   * @param options - The options for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    property: ConditionalKeys<ExtractPluginSettings<TPlugin>, UIValue>,
    options?: BindOptions
  ): TValueComponent;
  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @typeParam Property - The property of the plugin settings to bind to.
   * @param valueComponent - The value component to bind.
   * @param property - The property of the plugin settings to bind to.
   * @param options - The options for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent,
    Property extends StringKeys<ExtractPluginSettings<TPlugin>>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    property: Property,
    options: BindOptionsExtended<ExtractPluginSettings<TPlugin>, UIValue, Property>
  ): TValueComponent;
  /**
   * Binds a value component to a plugin setting.
   *
   * @typeParam UIValue - The type of the value of the UI component.
   * @typeParam TValueComponent - The type of the value component.
   * @typeParam Property - The property of the plugin settings to bind to.
   * @param valueComponent - The value component to bind.
   * @param property - The property of the plugin settings to bind to.
   * @param options - The options for binding the value component.
   * @returns The value component.
   */
  public bind<
    UIValue,
    TValueComponent,
    Property extends StringKeys<ExtractPluginSettings<TPlugin>>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    property: Property,
    options?: BindOptions
  ): TValueComponent {
    type PluginSettings = ExtractPluginSettings<TPlugin>;
    type PropertyType = PluginSettings[Property];
    const DEFAULT_OPTIONS: Required<BindOptionsExtended<PluginSettings, UIValue, Property>> = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      componentToPluginSettingsValueConverter: (value: UIValue): PropertyType => value as PropertyType,
      onChanged: noop,
      pluginSettingsToComponentValueConverter: (value: PropertyType): UIValue => value as UIValue,
      shouldShowValidationMessage: true
    };

    const optionsExt: Required<BindOptionsExtended<PluginSettings, UIValue, Property>> = { ...DEFAULT_OPTIONS, ...options };

    const validatorElement = getValidatorComponent(valueComponent)?.validatorEl;

    const propertyObj = this.plugin.settingsManager.getProperty(property);

    valueComponent
      .setValue(optionsExt.pluginSettingsToComponentValueConverter(propertyObj.get() as PropertyType))
      .onChange(async (uiValue) => {
        const convertedValue = optionsExt.componentToPluginSettingsValueConverter(uiValue);
        if (isValidationMessageHolder(convertedValue)) {
          propertyObj.validationMessage = convertedValue.validationMessage;
          await propertyObj.set(undefined);
        } else {
          await propertyObj.set(convertedValue);
        }
        await optionsExt.onChanged();
      });

    validatorElement?.addEventListener('focus', validate);
    validatorElement?.addEventListener('blur', validate);

    validate();
    return valueComponent;

    function validate(): void {
      if (!validatorElement) {
        return;
      }

      if (!propertyObj.validationMessage) {
        validatorElement.setCustomValidity('');
        validatorElement.checkValidity();
        propertyObj.validationMessage = validatorElement.validationMessage;
      }

      validatorElement.setCustomValidity(propertyObj.validationMessage);
      validatorElement.title = propertyObj.validationMessage;
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

function isValidationMessageHolder(value: unknown): value is ValidationMessageHolder {
  return !!(value as Partial<ValidationMessageHolder>).validationMessage;
}
