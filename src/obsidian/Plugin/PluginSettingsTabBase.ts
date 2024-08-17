import { PluginSettingTab } from "obsidian";
import { PluginBase } from "./PluginBase.ts";
import type { KeysMatching } from "../../Type.ts";

interface ValueComponent<T> {
  setValue(value: T): this;
  onChange(callback: (newValue: T) => Promise<void>): this;
}

export abstract class PluginSettingsTabBase<TPlugin extends PluginBase<PluginSettings>, PluginSettings extends object> extends PluginSettingTab {
  public constructor(public override plugin: TPlugin) {
    super(plugin.app, plugin);
  }

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
