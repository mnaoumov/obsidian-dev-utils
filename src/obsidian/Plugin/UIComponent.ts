import {
  DropdownComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent
} from 'obsidian';

import type { KeysMatching } from '../../@types.ts';
import type { PluginBase } from './PluginBase.ts';

/**
 * A UI component that can be bound to a plugin setting.
 */
export interface UIComponent<UIValue> {
  /**
   * Sets the value of the component.
   * @param value - The value to set on the component.
   */
  setValue(value: UIValue): this;

  /**
   * Sets a callback function to be called when the value of the component changes.
   * @param callback - A callback function that is called when the value of the component changes.
   */
  onChange(callback: (newValue: UIValue) => Promise<void>): this;
}

/**
 * A UI component that can be validated.
 */
interface ValidatorElement {
  /**
   * Sets a custom error message on the element.
   * @param error - The error message to set on the element.
   */
  setCustomValidity(error: string): void;

  /**
   * Reports the validity of the element.
   */
  reportValidity(): boolean;
}

/**
 * Options for binding a value component to a plugin setting.
 */
interface BindUIComponentOptions<PluginSettings, UIValueType> {
  // If true, saves the plugin settings automatically after the component value changes. Default is `true`.
  autoSave?: boolean;

  /**
   * The plugin settings object to bind the component to. Default is the plugin's current settings.
   */
  pluginSettings?: PluginSettings;

  /**
   * Validates the UI value before setting it on the plugin settings.
   * @param uiValue - The value of the UI component.
   * @returns An error message if the value is invalid, or `null` if it is valid.
   */
  uiValueValidator?: (uiValue: UIValueType) => string | null;
}

/**
 * Extended options for binding a value component to a plugin setting.
 */
interface BindUIComponentOptionsExtended<PluginSettings, UIValueType, Property extends keyof PluginSettings> extends BindUIComponentOptions<PluginSettings, UIValueType> {
  /**
 * Converts the setting value to the value used by the UI component.
 * @param propertyValue - The value of the property in the plugin settings.
 * @returns The value to set on the UI component.
 */
  settingToUIValueConverter: (propertyValue: PluginSettings[Property]) => UIValueType;

  /**
   * Converts the UI component's value back to the setting value.
   * @param uiValue - The value of the UI component.
   * @returns The value to set on the plugin settings.
   */
  uiToSettingValueConverter: (uiValue: UIValueType) => PluginSettings[Property];
}

/**
 * Binds a value component to a property in the plugin settings with optional automatic saving and value conversion.
 *
 * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
 * @typeParam TUIComponent - The type of the value component extending `UIComponent`.
 * @typeParam Property - The key of the plugin setting that the component is bound to.
 * @typeParam UIValueType - The inferred type based on the UI component's type.
 * @typeParam PluginSettings - The inferred type of the plugin settings object.
 *
 * @param plugin - The plugin.
 * @param uiComponent - The component that will display and interact with the setting value.
 * @param property - The property key in `PluginSettings` to bind to the UI component.
 * @param options - Configuration options.
 *
 * @returns The `UIComponent` instance that was bound to the property.
 */
export function bindUiComponent<
  Plugin extends PluginBase<object>,
  TUIComponent extends UIComponent<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  Property extends KeysMatching<PluginSettings, UIValueType>,
  UIValueType = TUIComponent extends UIComponent<infer P> ? P : never,
  PluginSettings extends object = Plugin extends PluginBase<infer P> ? P : never
>(
  plugin: Plugin,
  uiComponent: TUIComponent,
  property: Property,
  options?: BindUIComponentOptions<PluginSettings, UIValueType>
): TUIComponent;

/**
 * Binds a value component to a property in the plugin settings with optional automatic saving and value conversion.
 *
 * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
 * @typeParam TUIComponent - The type of the value component extending `UIComponent`.
 * @typeParam Property - The key of the plugin setting that the component is bound to.
 * @typeParam UIValueType - The inferred type based on the UI component's type.
 * @typeParam PluginSettings - The inferred type of the plugin settings object.
 *
 * @param plugin - The plugin.
 * @param uiComponent - The component that will display and interact with the setting value.
 * @param property - The property key in `PluginSettings` to bind to the UI component.
 * @param options - Configuration options.
 *
 * @returns The `UIComponent` instance that was bound to the property.
 */
export function bindUiComponent<
  Plugin extends PluginBase<object>,
  TUIComponent extends UIComponent<unknown>,
  Property extends keyof PluginSettings,
  UIValueType = TUIComponent extends UIComponent<infer P> ? P : never,
  PluginSettings extends object = Plugin extends PluginBase<infer P> ? P : never
>(
  plugin: Plugin,
  uiComponent: TUIComponent,
  property: Property,
  options: BindUIComponentOptionsExtended<PluginSettings, UIValueType, Property>
): TUIComponent;

/**
 * Binds a value component to a property in the plugin settings with optional automatic saving and value conversion.
 *
 * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
 * @typeParam TUIComponent - The type of the value component extending `UIComponent`.
 * @typeParam Property - The key of the plugin setting that the component is bound to.
 * @typeParam UIValueType - The inferred type based on the UI component's type.
 * @typeParam PluginSettings - The inferred type of the plugin settings object.
 *
 * @param plugin - The plugin.
 * @param uiComponent - The component that will display and interact with the setting value.
 * @param property - The property key in `PluginSettings` to bind to the UI component.
 * @param options - Configuration options.
 *
 * @returns The `UIComponent` instance that was bound to the property.
 */
export function bindUiComponent<
  Plugin extends PluginBase<object>,
  TUIComponent extends UIComponent<unknown>,
  Property extends keyof PluginSettings,
  UIValueType = TUIComponent extends UIComponent<infer P> ? P : never,
  PluginSettings extends object = Plugin extends PluginBase<infer P> ? P : never
>(
  plugin: Plugin,
  uiComponent: TUIComponent,
  property: Property,
  options?: BindUIComponentOptions<PluginSettings, UIValueType>
): TUIComponent {
  type PropertyType = PluginSettings[Property];
  const DEFAULT_OPTIONS: BindUIComponentOptionsExtended<PluginSettings, UIValueType, Property> = {
    autoSave: true,
    settingToUIValueConverter: (value): UIValueType => value as UIValueType,
    uiToSettingValueConverter: (value): PropertyType => value as PropertyType
  };

  const optionsExt: BindUIComponentOptionsExtended<PluginSettings, UIValueType, Property> = { ...DEFAULT_OPTIONS, ...options };
  const pluginExt = plugin as unknown as PluginBase<PluginSettings>;
  const uiComponentExt = uiComponent as UIComponent<UIValueType>;
  const pluginSettingsFn = (): PluginSettings => optionsExt.pluginSettings ?? pluginExt.settingsCopy;
  uiComponentExt
    .setValue(optionsExt.settingToUIValueConverter(pluginSettingsFn()[property]))
    .onChange(async (uiValue) => {
      if (optionsExt.uiValueValidator) {
        const errorMessage = optionsExt.uiValueValidator(uiValue);
        const validatorElement = getValidatorElement(uiComponent);
        if (validatorElement) {
          validatorElement.setCustomValidity(errorMessage ?? '');
          validatorElement.reportValidity();
        }
        if (errorMessage) {
          return;
        }
      }
      const pluginSettings = pluginSettingsFn();
      pluginSettings[property] = optionsExt.uiToSettingValueConverter(uiValue);
      if (optionsExt.autoSave) {
        await pluginExt.saveSettings(pluginSettings);
      }
    });
  return uiComponent;
}

/**
 * Gets the validator element from a UI component if it exists.
 * @param uiComponent - The UI component to get the validator element from.
 * @returns The validator element if it exists, or `null` if it does not.
 */
function getValidatorElement(uiComponent: UIComponent<unknown>): ValidatorElement | null {
  if (uiComponent instanceof DropdownComponent) {
    return uiComponent.selectEl;
  }

  if (uiComponent instanceof SliderComponent) {
    return uiComponent.sliderEl;
  }

  if (uiComponent instanceof TextAreaComponent) {
    return uiComponent.inputEl;
  }

  if (uiComponent instanceof TextComponent) {
    return uiComponent.inputEl;
  }

  return null;
}
