/**
 * @packageDocumentation ValueComponent
 * Contains utility types and functions for handling value components, which are UI components that display and edit values.
 */

import {
  DropdownComponent,
  SliderComponent,
  TextAreaComponent,
  TextComponent,
  ValueComponent
} from 'obsidian';

import type { KeysMatching } from '../../@types.ts';
import type { MaybePromise } from '../../Async.ts';
import type { ValidatorElement } from '../../HTMLElement.ts';
import type { PluginBase } from './PluginBase.ts';
import type { PluginSettingsBase } from './PluginSettingsBase.ts';

import { invokeAsyncSafely } from '../../Async.ts';
import { assignWithNonEnumerableProperties } from '../../Object.ts';

/**
 * Options for binding a value component to a plugin setting.
 */
interface BindValueComponentOptions<PluginSettings, UIValue> {
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
interface BindValueComponentOptionsExtended<PluginSettings, UIValue, Property extends keyof PluginSettings> extends BindValueComponentOptions<PluginSettings, UIValue> {
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

/**
 * ValueComponent that can be used as an original ValueComponent with extended functionality.
 */
type ValueComponentExType<UIValue, TValueComponent extends ValueComponentWithChangeTracking<UIValue>> = TValueComponent & ValueComponentEx<UIValue, TValueComponent>;

/**
 * A ValueComponent that can track changes.
 */
interface ValueComponentWithChangeTracking<T> extends ValueComponent<T> {
  /**
   * Sets a callback function to be called when the value of the component changes.
   *
   * @param callback - A callback function that is called when the value of the component changes.
   */
  onChange(callback: (newValue: T) => Promise<void>): this;
}

/**
 * ValueComponent with extended functionality.
 */
class ValueComponentEx<UIValue, TValueComponent extends ValueComponentWithChangeTracking<UIValue>> {
  public constructor(private valueComponent: TValueComponent) {
  }

  /**
   * Returns the ValueComponent with extended functionality.
   */
  public asExtended(): ValueComponentExType<UIValue, TValueComponent> {
    return assignWithNonEnumerableProperties({}, this.valueComponent, this);
  }

  /**
   * Binds the ValueComponent to a property in the plugin settings.
   *
   * @typeParam PluginSettings - The type of the plugin settings object.
   * @typeParam Property - The key of the plugin setting that the component is bound to.
   * @param plugin - The plugin.
   * @param property - The property key in `PluginSettings` to bind to the UI component.
   * @param options - Configuration options.
   * @returns The `ValueComponent` instance that was bound to the property.
   */
  public bind<
    PluginSettings extends PluginSettingsBase,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    Property extends KeysMatching<PluginSettings, UIValue>
  >(
    plugin: PluginBase<PluginSettings>,
    property: Property,
    options?: BindValueComponentOptions<PluginSettings, UIValue>
  ): ValueComponentExType<UIValue, TValueComponent>;

  /**
   * Binds the ValueComponent to a property in the plugin settings.
   *
   * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
   * @typeParam Property - The key of the plugin setting that the component is bound to.
   * @typeParam PluginSettings - The type of the plugin settings object.
   * @param plugin - The plugin.
   * @param property - The property key in `PluginSettings` to bind to the UI component.
   * @param options - Configuration options.
   * @returns The `ValueComponent` instance that was bound to the property.
   */
  public bind<
    PluginSettings extends PluginSettingsBase,
    Property extends keyof PluginSettings
  >(
    plugin: PluginBase<PluginSettings>,
    property: Property,
    options: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property>
  ): ValueComponentExType<UIValue, TValueComponent>;

  /**
   * Binds the ValueComponent to a property in the plugin settings.
   *
   * @typeParam Plugin - The type of the plugin that extends `PluginBase`.
   * @typeParam Property - The key of the plugin setting that the component is bound to.
   * @typeParam PluginSettings - The type of the plugin settings object.
   * @param plugin - The plugin.
   * @param property - The property key in `PluginSettings` to bind to the UI component.
   * @param options - Configuration options.
   * @returns The `ValueComponent` instance that was bound to the property.
   */
  public bind<
    PluginSettings extends PluginSettingsBase,
    Property extends keyof PluginSettings
  >(
    plugin: PluginBase<PluginSettings>,
    property: Property,
    options?: BindValueComponentOptions<PluginSettings, UIValue>
  ): ValueComponentExType<UIValue, TValueComponent> {
    type PropertyType = PluginSettings[Property];
    const DEFAULT_OPTIONS: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property> = {
      componentToPluginSettingsValueConverter: (value): PropertyType => value as PropertyType,
      pluginSettingsToComponentValueConverter: (value): UIValue => value as UIValue,
      shouldAutoSave: true
    };

    const optionsExt: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property> = { ...DEFAULT_OPTIONS, ...options };
    const pluginExt = plugin as unknown as PluginBase<PluginSettings>;
    const pluginSettingsFn = (): PluginSettings => optionsExt.pluginSettings ?? pluginExt.settingsCopy;

    const validate = async (uiValue?: UIValue): Promise<boolean> => {
      if (!optionsExt.valueValidator) {
        return true;
      }
      uiValue ??= this.valueComponent.getValue();
      const errorMessage = await optionsExt.valueValidator(uiValue) as string | undefined;
      const validatorElement = getValidatorElement(this.valueComponent);
      if (validatorElement) {
        validatorElement.setCustomValidity(errorMessage ?? '');
        validatorElement.reportValidity();
      }

      return !errorMessage;
    };

    this.valueComponent
      .setValue(optionsExt.pluginSettingsToComponentValueConverter(pluginSettingsFn()[property]))
      .onChange(async (uiValue) => {
        if (!await validate(uiValue)) {
          return;
        }
        const pluginSettings = pluginSettingsFn();
        pluginSettings[property] = optionsExt.componentToPluginSettingsValueConverter(uiValue);
        if (optionsExt.shouldAutoSave) {
          await pluginExt.saveSettings(pluginSettings);
        }

        await optionsExt.onChanged?.();
      });

    invokeAsyncSafely(validate);

    const validatorElement = getValidatorElement(this.valueComponent);
    if (validatorElement) {
      validatorElement.addEventListener('focus', () => {
        invokeAsyncSafely(validate);
      });
      validatorElement.addEventListener('blur', () => {
        invokeAsyncSafely(validate);
      });
    }

    return this.asExtended();
  }
}

/**
 * Extends a ValueComponent with additional functionality.
 *
 * @typeParam UIValue - The type of the value the component displays.
 * @typeParam TValueComponent - The type of the value component extending `ValueComponent`.
 * @param valueComponent - The value component to extend.
 * @returns The value component with extended functionality.
 */
export function extend<UIValue, TValueComponent extends ValueComponentWithChangeTracking<UIValue>>(valueComponent: TValueComponent & ValueComponentWithChangeTracking<UIValue>): ValueComponentExType<UIValue, TValueComponent> {
  return new ValueComponentEx<UIValue, TValueComponent>(valueComponent).asExtended();
}

/**
 * Gets the validator element from a value component if it exists.
 *
 * @param valueComponent - The value component to get the validator element from.
 * @returns The validator element if it exists, or `null` if it does not.
 */
function getValidatorElement<UIValue>(valueComponent: ValueComponentWithChangeTracking<UIValue>): null | ValidatorElement {
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
