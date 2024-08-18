/**
 * @fileoverview This module defines a base class for creating plugin setting tabs in Obsidian.
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
   * Binds a value component to a specific property in the plugin settings.
   * Updates the plugin settings when the value component's value changes.
   *
   * @template TValueComponent - The type of the value component.
   * @template Property - The type of the property in the plugin settings that the value component is bound to.
   * @param {TValueComponent} valueComponent - The value component to bind.
   * @param {PluginSettings} pluginSettings - The plugin settings object.
   * @param {Property} property - The property in the plugin settings to bind the value component to.
   * @param {boolean} [autoSave=true] - Whether to automatically save settings when the value changes.
   * @returns {TValueComponent} The bound value component.
   */
  protected bindValueComponent<
    TValueComponent extends ValueComponent<unknown>,
    Property extends KeysMatching<PluginSettings, PropertyType>,
    PropertyType = TValueComponent extends ValueComponent<infer P> ? P : never,
  >(
    valueComponent: TValueComponent,
    pluginSettings: PluginSettings,
    property: Property,
    autoSave: boolean = true
  ): TValueComponent {
    valueComponent
      .setValue(pluginSettings[property])
      .onChange(async (newValue) => {
        pluginSettings[property] = newValue as PluginSettings[Property];
        if (autoSave) {
          await this.plugin.saveSettings(pluginSettings);
        }
      });
    return valueComponent;
  }
}
