/**
 * @file This module defines a base class for creating plugin setting tabs in Obsidian.
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
   * Binds a value component to a plugin setting property.
   *
   * @template TValueComponent - The type of the value component.
   * @template Property - The type of the plugin setting property.
   * @template PropertyType - The type of the plugin setting property value.
   *
   * @param valueComponent - The value component to bind.
   * @param pluginSettings - The plugin settings object.
   * @param property - The property to bind the value component to.
   * @param options - Additional options for binding.
   * @param options.autoSave - Whether to automatically save the settings when the value changes. Default is true.
   * @param options.settingToUIValueConverter - A function to convert the setting value to the UI value. Default is identity function.
   * @param options.uiToSettingValueConverter - A function to convert the UI value to the setting value. Default is identity function.
   *
   * @returns The bound value component.
   */
  protected bindValueComponent<
    TValueComponent extends ValueComponent<unknown>,
    Property extends KeysMatching<PluginSettings, PropertyType>,
    PropertyType = TValueComponent extends ValueComponent<infer P> ? P : never,
  >(
    valueComponent: TValueComponent,
    pluginSettings: PluginSettings,
    property: Property,
    {
      autoSave = true,
      settingToUIValueConverter = (value) => value,
      uiToSettingValueConverter = (value) => value
    }: {
      autoSave?: boolean
      settingToUIValueConverter?: (value: PluginSettings[Property]) => PluginSettings[Property],
      uiToSettingValueConverter?: (value: PluginSettings[Property]) => PluginSettings[Property]
    } = {}
  ): TValueComponent {
    valueComponent
      .setValue(settingToUIValueConverter(pluginSettings[property]))
      .onChange(async (newValue) => {
        pluginSettings[property] = uiToSettingValueConverter(newValue as PluginSettings[Property]);
        if (autoSave) {
          await this.plugin.saveSettings(pluginSettings);
        }
      });
    return valueComponent;
  }
}
