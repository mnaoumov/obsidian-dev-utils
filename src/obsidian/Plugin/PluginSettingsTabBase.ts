/**
 * @module PluginSettingsTabBase
 * This module defines a base class for creating plugin setting tabs in Obsidian.
 * It provides a utility method to bind value components to plugin settings and handle changes.
 */

import { PluginSettingTab } from "obsidian";
import { PluginBase } from "./PluginBase.ts";
import type { KeysMatching } from "../../@types.ts";

interface ValueComponent<T> {
  setValue(value: T): this;
  onChange(callback: (newValue: T) => Promise<void>): this;
}

/**
 * Base class for creating plugin settings tabs in Obsidian.
 * Provides a method for binding value components to plugin settings and handling changes.
 *
 * @template TPlugin - The type of the plugin that extends PluginBase.
 * @template PluginSettings - The type of the plugin settings object.
 */
export abstract class PluginSettingsTabBase<
  TPlugin extends PluginBase<PluginSettings>,
  PluginSettings extends object
> extends PluginSettingTab {
  /**
   * Creates an instance of PluginSettingsTabBase.
   *
   * @param {TPlugin} plugin - The plugin instance to which this settings tab belongs.
   */
  public constructor(public override plugin: TPlugin) {
    super(plugin.app, plugin);
  }

  /**
   * Binds a value component to a property in the plugin settings with optional automatic saving and value conversion.
   *
   * @typeParam TValueComponent - The type of the value component extending `ValueComponent`.
   * @typeParam Property - The key of the plugin setting that the component is bound to.
   * @typeParam PropertyType - The inferred type of the property based on the value component's type.
   *
   * @param valueComponent - The component that will display and interact with the setting value.
   * @param property - The property key in `PluginSettings` to bind to the component.
   * @param options - Configuration options.
   * @param options.autoSave - If true, saves the plugin settings automatically after the component value changes.
   *
   * @returns The `TValueComponent` instance that was bound to the property.
   */
  protected bindValueComponent<
    TValueComponent extends ValueComponent<unknown>,
    Property extends KeysMatching<PluginSettings, UIValueType>,
    UIValueType = TValueComponent extends ValueComponent<infer P> ? P : never,
  >(
    valueComponent: TValueComponent,
    property: Property,
    options?: {
      autoSave?: boolean,
      pluginSettings?: PluginSettings
    }
  ): TValueComponent;

  /**
   * Binds a value component to a property in the plugin settings with automatic saving and custom value conversion.
   *
   * @typeParam TValueComponent - The type of the value component extending `ValueComponent`.
   * @typeParam Property - The key of the plugin setting that the component is bound to.
   * @typeParam UIValueType - The inferred type of the UI value based on the value component's type.
   *
   * @param valueComponent - The component that will display and interact with the setting value.
   * @param property - The property key in `PluginSettings` to bind to the component.
   * @param options - Configuration options.
   * @param options.autoSave - If true, saves the plugin settings automatically after the component value changes.
   * @param options.settingToUIValueConverter - A function that converts the setting value to the value used by the UI component.
   * @param options.uiToSettingValueConverter - A function that converts the UI component's value back to the setting value.
   *
   * @returns The `TValueComponent` instance that was bound to the property.
   */
  protected bindValueComponent<
    TValueComponent extends ValueComponent<unknown>,
    Property extends keyof PluginSettings,
    UIValueType = TValueComponent extends ValueComponent<infer P> ? P : never,
  >(
    valueComponent: TValueComponent,
    property: Property,
    options: {
      autoSave?: boolean,
      pluginSettings?: PluginSettings
      settingToUIValueConverter: (propertyValue: PluginSettings[Property]) => UIValueType,
      uiToSettingValueConverter: (uiValue: UIValueType) => PluginSettings[Property]
    }
  ): TValueComponent;

  /**
   * Internal implementation of `bindValueComponent` that handles both overloads.
   *
   * @typeParam TValueComponent - The type of the value component extending `ValueComponent`.
   * @typeParam Property - The key of the plugin setting that the component is bound to.
   * @typeParam UIValueType - The inferred type of the UI value based on the value component's type.
   *
   * @param valueComponent - The component that will display and interact with the setting value.
   * @param property - The property key in `PluginSettings` to bind to the component.
   * @param options - Configuration options.
   * @param options.autoSave - If true, saves the plugin settings automatically after the component value changes.
   * @param options.settingToUIValueConverter - A function that converts the setting value to the value used by the UI component.
   * @param options.uiToSettingValueConverter - A function that converts the UI component's value back to the setting value.
   *
   * @returns The `TValueComponent` instance that was bound to the property.
   */
  protected bindValueComponent<
    TValueComponent extends ValueComponent<unknown>,
    Property extends keyof PluginSettings,
    UIValueType = TValueComponent extends ValueComponent<infer P> ? P : never,
  >(
    valueComponent: TValueComponent,
    property: Property,
    {
      autoSave,
      pluginSettings,
      settingToUIValueConverter,
      uiToSettingValueConverter
    }: {
      autoSave?: boolean,
      pluginSettings?: PluginSettings,
      settingToUIValueConverter: (propertyValue: PluginSettings[Property]) => UIValueType,
      uiToSettingValueConverter: (uiValue: UIValueType) => PluginSettings[Property]
    }
  ): TValueComponent {
    pluginSettings ??= this.plugin.settingsCopy;
    (valueComponent as ValueComponent<UIValueType>)
      .setValue(settingToUIValueConverter(pluginSettings[property]))
      .onChange(async (newValue) => {
        pluginSettings[property] = uiToSettingValueConverter(newValue);
        if (autoSave) {
          await this.plugin.saveSettings(pluginSettings);
        }
      });
    return valueComponent;
  }
}
