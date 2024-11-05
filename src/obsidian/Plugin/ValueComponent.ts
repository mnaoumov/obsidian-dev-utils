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

/**
 * ValueComponent that can be used as an original ValueComponent with extended functionality.
 */
type ValueComponentExType<UIValue, TValueComponent extends ValueComponentWithChangeTracking<UIValue>> = TValueComponent & ValueComponentEx<UIValue, TValueComponent>;

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
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return { ...this.valueComponent, ...this };
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
    PluginSettings extends object,
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
    PluginSettings extends object,
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
    PluginSettings extends object,
    Property extends keyof PluginSettings
  >(
    plugin: PluginBase<PluginSettings>,
    property: Property,
    options?: BindValueComponentOptions<PluginSettings, UIValue>
  ): ValueComponentExType<UIValue, TValueComponent> {
    type PropertyType = PluginSettings[Property];
    const DEFAULT_OPTIONS: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property> = {
      autoSave: true,
      pluginSettingsToComponentValueConverter: (value): UIValue => value as UIValue,
      componentToPluginSettingsValueConverter: (value): PropertyType => value as PropertyType
    };

    const optionsExt: BindValueComponentOptionsExtended<PluginSettings, UIValue, Property> = { ...DEFAULT_OPTIONS, ...options };
    const pluginExt = plugin as unknown as PluginBase<PluginSettings>;
    const pluginSettingsFn = (): PluginSettings => optionsExt.pluginSettings ?? pluginExt.settingsCopy;
    this.valueComponent
      .setValue(optionsExt.pluginSettingsToComponentValueConverter(pluginSettingsFn()[property]))
      .onChange(async (uiValue) => {
        if (!this.validate(optionsExt.valueValidator, uiValue)) {
          return;
        }
        const pluginSettings = pluginSettingsFn();
        pluginSettings[property] = optionsExt.componentToPluginSettingsValueConverter(uiValue);
        if (optionsExt.autoSave) {
          await pluginExt.saveSettings(pluginSettings);
        }

        await optionsExt.onChanged?.();
      });

    const validatorElement = getValidatorElement(this.valueComponent);
    if (validatorElement) {
      validatorElement.addEventListener('focus', () => this.validate(optionsExt.valueValidator));
      validatorElement.addEventListener('blur', () => this.validate(optionsExt.valueValidator));
    }

    return this.asExtended();
  }

  private validate(valueValidator: ((uiValue: UIValue) => string | null) | undefined, uiValue?: UIValue): boolean {
    if (!valueValidator) {
      return true;
    }
    uiValue ??= this.valueComponent.getValue();
    const errorMessage = valueValidator(uiValue);
    const validatorElement = getValidatorElement(this.valueComponent);
    if (validatorElement) {
      validatorElement.setCustomValidity(errorMessage ?? '');
      validatorElement.reportValidity();
    }

    return !errorMessage;
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

  /**
   * A callback function that is called when the value of the component changes.
   */
  onChanged?: () => MaybePromise<void>;
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
 * Gets the validator element from a value component if it exists.
 *
 * @param valueComponent - The value component to get the validator element from.
 * @returns The validator element if it exists, or `null` if it does not.
 */
function getValidatorElement<UIValue>(valueComponent: ValueComponentWithChangeTracking<UIValue>): ValidatorElement | null {
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
