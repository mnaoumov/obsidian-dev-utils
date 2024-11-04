import {
  DropdownComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent
} from 'obsidian';

import type { KeysMatching } from '../../@types.ts';
import type { PluginBase } from './PluginBase.ts';

/**
 * A ValueComponent that can be bound to a plugin setting.
 */
export interface ValueComponent<UIValue> {
  /**
   * Gets the value of the component.
   *
   * @returns The value of the component.
   */
  getValue(): UIValue;

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
 * A HTML element that can be validated.
 */
interface ValidatorElement extends HTMLElement {
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
interface BindValueComponentOptions<PluginSettings, UIValue> {
  /**
   * If true, saves the plugin settings automatically after the component value changes. Default is `true`.
   */
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
  valueValidator?: (uiValue: UIValue) => string | null;
}

/**
 * Extended options for binding a value component to a plugin setting.
 */
interface BindValueComponentOptionsExtended<PluginSettings, UIValue, Property extends keyof PluginSettings> extends BindValueComponentOptions<PluginSettings, UIValue> {
  /**
   * Converts the plugin settings value to the value used by the UI component.
   * @param pluginSettingsValue - The value of the property in the plugin settings.
   * @returns The value to set on the UI component.
   */
  pluginSettingsToComponentValueConverter: (pluginSettingsValue: PluginSettings[Property]) => UIValue;

  /**
   * Converts the UI component's value back to the plugin settings value.
   * @param uiValue - The value of the UI component.
   * @returns The value to set on the plugin settings.
   */
  componentToPluginSettingsValueConverter: (uiValue: UIValue) => PluginSettings[Property];
}

/**
 * Binds a value component to a property in the plugin settings with optional automatic saving and value conversion.
 *
 * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
 * @typeParam TValueComponent - The type of the value component extending `ValueComponent`.
 * @typeParam Property - The key of the plugin setting that the component is bound to.
 * @typeParam UIValue - The inferred type based on the UI component's type.
 * @typeParam PluginSettings - The inferred type of the plugin settings object.
 *
 * @param plugin - The plugin.
 * @param valueComponent - The component that will display and interact with the setting value.
 * @param property - The property key in `PluginSettings` to bind to the UI component.
 * @param options - Configuration options.
 * @returns The `ValueComponent` instance that was bound to the property.
 */
export function bindValueComponent<
  Plugin extends PluginBase<object>,
  TValueComponent extends ValueComponent<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  Property extends KeysMatching<PluginSettings, UIValue>,
  UIValue = TValueComponent extends ValueComponent<infer P> ? P : never,
  PluginSettings extends object = Plugin extends PluginBase<infer P> ? P : never
>(
  plugin: Plugin,
  valueComponent: TValueComponent,
  property: Property,
  options?: BindValueComponentOptions<PluginSettings, UIValue>
): TValueComponent;

/**
 * Binds a value component to a property in the plugin settings with optional automatic saving and value conversion.
 *
 * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
 * @typeParam TValueComponent - The type of the value component extending `ValueComponent`.
 * @typeParam Property - The key of the plugin setting that the component is bound to.
 * @typeParam UIValue - The inferred type based on the value component's type.
 * @typeParam PluginSettings - The inferred type of the plugin settings object.
 *
 * @param plugin - The plugin.
 * @param valueComponent - The component that will display and interact with the setting value.
 * @param property - The property key in `PluginSettings` to bind to the UI component.
 * @param options - Configuration options.
 * @returns The `ValueComponent` instance that was bound to the property.
 */
export function bindValueComponent<
  Plugin extends PluginBase<object>,
  TValueComponent extends ValueComponent<unknown>,
  Property extends keyof PluginSettings,
  UIValue = TValueComponent extends ValueComponent<infer P> ? P : never,
  PluginSettings extends object = Plugin extends PluginBase<infer P> ? P : never
>(
  plugin: Plugin,
  valueComponent: TValueComponent,
  property: Property,
  options: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property>
): TValueComponent;

/**
 * Binds a value component to a property in the plugin settings with optional automatic saving and value conversion.
 *
 * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
 * @typeParam TValueComponent - The type of the value component extending `ValueComponent`.
 * @typeParam Property - The key of the plugin setting that the component is bound to.
 * @typeParam UIValue - The inferred type based on the value component's type.
 * @typeParam PluginSettings - The inferred type of the plugin settings object.
 *
 * @param plugin - The plugin.
 * @param valueComponent - The component that will display and interact with the setting value.
 * @param property - The property key in `PluginSettings` to bind to the UI component.
 * @param options - Configuration options.
 * @returns The `ValueComponent` instance that was bound to the property.
 */
export function bindValueComponent<
  Plugin extends PluginBase<object>,
  TValueComponent extends ValueComponent<unknown>,
  Property extends keyof PluginSettings,
  UIValue = TValueComponent extends ValueComponent<infer P> ? P : never,
  PluginSettings extends object = Plugin extends PluginBase<infer P> ? P : never
>(
  plugin: Plugin,
  valueComponent: TValueComponent,
  property: Property,
  options?: BindValueComponentOptions<PluginSettings, UIValue>
): TValueComponent {
  type PropertyType = PluginSettings[Property];
  const DEFAULT_OPTIONS: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property> = {
    autoSave: true,
    pluginSettingsToComponentValueConverter: (value): UIValue => value as UIValue,
    componentToPluginSettingsValueConverter: (value): PropertyType => value as PropertyType
  };

  const optionsExt: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property> = { ...DEFAULT_OPTIONS, ...options };
  const pluginExt = plugin as unknown as PluginBase<PluginSettings>;
  const uiComponentExt = valueComponent as ValueComponent<UIValue>;
  const pluginSettingsFn = (): PluginSettings => optionsExt.pluginSettings ?? pluginExt.settingsCopy;
  uiComponentExt
    .setValue(optionsExt.pluginSettingsToComponentValueConverter(pluginSettingsFn()[property]))
    .onChange(async (uiValue) => {
      if (!validateComponent(uiValue)) {
        return;
      }
      const pluginSettings = pluginSettingsFn();
      pluginSettings[property] = optionsExt.componentToPluginSettingsValueConverter(uiValue);
      if (optionsExt.autoSave) {
        await pluginExt.saveSettings(pluginSettings);
      }
    });

  const validatorElement = getValidatorElement(valueComponent);
  if (validatorElement) {
    validatorElement.addEventListener('focus', () => validateComponent());
    validatorElement.addEventListener('blur', () => validateComponent());
  }

  return valueComponent;

  function validateComponent(uiValue?: UIValue): boolean {
    if (!optionsExt.valueValidator) {
      return true;
    }
    uiValue ??= uiComponentExt.getValue();
    const errorMessage = optionsExt.valueValidator(uiValue);
    const validatorElement = getValidatorElement(valueComponent);
    if (validatorElement) {
      validatorElement.setCustomValidity(errorMessage ?? '');
      validatorElement.reportValidity();
    }

    return !errorMessage;
  }
}

/**
 * Gets the validator element from a value component if it exists.
 *
 * @param valueComponent - The value component to get the validator element from.
 * @returns The validator element if it exists, or `null` if it does not.
 */
function getValidatorElement(valueComponent: ValueComponent<unknown>): ValidatorElement | null {
  if (valueComponent instanceof DropdownComponent) {
    return valueComponent.selectEl;
  }

  if (valueComponent instanceof SliderComponent) {
    return valueComponent.sliderEl;
  }

  if (valueComponent instanceof TextAreaComponent) {
    return valueComponent.inputEl;
  }

  if (valueComponent instanceof TextComponent) {
    return valueComponent.inputEl;
  }

  return null;
}
