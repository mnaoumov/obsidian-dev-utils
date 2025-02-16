/**
 * @packageDocumentation PluginSettingsTabBase
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import type { BaseComponent } from 'obsidian';

import { PluginSettingTab } from 'obsidian';

import type { MaybePromise } from '../../Async.ts';
import type { KeysMatching } from '../../Object.ts';
import type { ValueComponentWithChangeTracking } from '../Components/ValueComponentWithChangeTracking.ts';
import type { PluginSettingsBase } from './PluginSettingsBase.ts';

import {
  convertAsyncToSync,
  invokeAsyncSafely
} from '../../Async.ts';
import { CssClass } from '../../CssClass.ts';
import { noop } from '../../Function.ts';
import { getValidatorComponent } from '../Components/ValidatorComponent.ts';
import { PluginBase } from './PluginBase.ts';
import { getPluginId } from './PluginId.ts';

/**
 * Options for binding a value component to a plugin setting.
 */
export interface BindOptions<PluginSettings, UIValue> {
  /**
   * A callback function that is called when the value of the component changes.
   */
  onChanged?: () => MaybePromise<void>;

  /**
   * The plugin settings object to bind the component to. Default is the plugin's current settings.
   */
  pluginSettings?: PluginSettings;

  /**
   * If true, saves the plugin settings automatically after the component value changes. Default is `true`.
   */
  shouldAutoSave?: boolean;

  /**
   * If true, shows the validation message when the component value is invalid. Default is `true`.
   */
  shouldShowValidationMessage?: boolean;

  /**
   * Validates the UI value before setting it on the plugin settings.
   * @param uiValue - The value of the UI component.
   * @returns An error message if the value is invalid, or `(empty string)` or `void` if it is valid.
   */
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  valueValidator?: (uiValue: UIValue) => MaybePromise<string | void>;
}

/**
 * Extended options for binding a value component to a plugin setting.
 */
export interface BindOptionsExtended<PluginSettings, UIValue, Property extends keyof PluginSettings> extends BindOptions<PluginSettings, UIValue> {
  /**
   * Converts the UI component's value back to the plugin settings value.
   * @param uiValue - The value of the UI component.
   * @returns The value to set on the plugin settings.
   */
  componentToPluginSettingsValueConverter: (uiValue: UIValue) => PluginSettings[Property];

  /**
   * Converts the plugin settings value to the value used by the UI component.
   * @param pluginSettingsValue - The value of the property in the plugin settings.
   * @returns The value to set on the UI component.
   */
  pluginSettingsToComponentValueConverter: (pluginSettingsValue: PluginSettings[Property]) => UIValue;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractPluginSettings<T extends PluginBase<any>> = PluginSettingsBase & T['settingsClone'];

/**
 * Base class for creating plugin settings tabs in Obsidian.
 * Provides a method for binding value components to plugin settings and handling changes.
 *
 * @typeParam TPlugin - The type of the plugin that extends PluginBase.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class PluginSettingsTabBase<TPlugin extends PluginBase<any>> extends PluginSettingTab {
  private validatorsMap = new WeakMap<BaseComponent, () => Promise<boolean>>();

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
  protected bind<
    UIValue,
    TValueComponent
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    property: KeysMatching<ExtractPluginSettings<TPlugin>, UIValue>,
    options?: BindOptions<ExtractPluginSettings<TPlugin>, UIValue>
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
  protected bind<
    UIValue,
    TValueComponent,
    Property extends keyof ExtractPluginSettings<TPlugin>
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
  protected bind<
    UIValue,
    TValueComponent,
    Property extends keyof ExtractPluginSettings<TPlugin>
  >(
    valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>,
    property: Property,
    options?: BindOptions<ExtractPluginSettings<TPlugin>, UIValue>
  ): TValueComponent {
    type PluginSettings = ExtractPluginSettings<TPlugin>;
    type PropertyType = PluginSettings[Property];
    const DEFAULT_OPTIONS: Required<BindOptionsExtended<PluginSettings, UIValue, Property>> = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      componentToPluginSettingsValueConverter: (value: UIValue): PropertyType => value as PropertyType,
      onChanged: noop,
      pluginSettings: undefined as PluginSettings,
      pluginSettingsToComponentValueConverter: (value: PropertyType): UIValue => value as UIValue,
      shouldAutoSave: true,
      shouldShowValidationMessage: true,
      valueValidator: noop
    };

    const optionsExt: Required<BindOptionsExtended<PluginSettings, UIValue, Property>> = { ...DEFAULT_OPTIONS, ...options };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const pluginSettingsFn = (): PluginSettings => optionsExt.pluginSettings ?? this.plugin.settingsClone;
    const validatorElement = getValidatorComponent(valueComponent)?.validatorEl;

    const validate = async (uiValue?: UIValue): Promise<boolean> => {
      uiValue ??= valueComponent.getValue();
      let errorMessage = await optionsExt.valueValidator(uiValue) as string | undefined;
      if (validatorElement) {
        if (!errorMessage) {
          validatorElement.setCustomValidity('');
          validatorElement.checkValidity();
          errorMessage = validatorElement.validationMessage;
        }

        validatorElement.setCustomValidity(errorMessage);
        validatorElement.title = errorMessage;
        if (validatorElement.isActiveElement() && optionsExt.shouldShowValidationMessage) {
          validatorElement.reportValidity();
        }
      }

      return !errorMessage;
    };

    valueComponent
      .setValue(optionsExt.pluginSettingsToComponentValueConverter(pluginSettingsFn()[property]))
      .onChange(async (uiValue) => {
        if (!await validate(uiValue)) {
          return;
        }
        const pluginSettings = pluginSettingsFn();
        pluginSettings[property] = optionsExt.componentToPluginSettingsValueConverter(uiValue);
        if (optionsExt.shouldAutoSave) {
          await this.plugin.saveSettings(pluginSettings);
        }

        await optionsExt.onChanged();
      });

    validatorElement?.addEventListener('focus', convertAsyncToSync(() => validate()));
    validatorElement?.addEventListener('blur', convertAsyncToSync(() => validate()));
    this.validatorsMap.set(valueComponent, () => validate());

    invokeAsyncSafely(() => validate());
    return valueComponent;
  }

  /**
   * Revalidates the value component.
   *
   * @param baseComponent - The base component to revalidate.
   * @returns A promise that resolves to a boolean indicating whether the value component is valid.
   */
  protected async revalidate(baseComponent: BaseComponent): Promise<boolean> {
    const validator = this.validatorsMap.get(baseComponent);
    if (validator) {
      return await validator();
    }

    return true;
  }
}
