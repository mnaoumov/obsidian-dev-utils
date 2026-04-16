/**
 * @file
 *
 * @deprecated This module is deprecated. The plugin architecture no longer requires PluginTypes.
 * PluginBase is now non-generic, and PluginSettingsManagerBase/PluginSettingsTabBase
 * are generic over the settings type directly.
 */

/* v8 ignore start -- Interface-only module; no runtime code to test. */
/* eslint-disable @typescript-eslint/no-deprecated -- This file defines deprecated types that reference each other. */

import type {
  PropertyValues,
  StringKeys
} from '../../type.ts';
import type { DefaultTranslationsBase } from '../i18n/default-translations-base.ts';
import type {
  PluginSettingsComponentBase,
  PluginSettingsState,
  ReadonlyPluginSettingsState
} from './components/plugin-settings-component.ts';
import type { PluginBase } from './plugin-base.ts';
import type { PluginSettingsTabBase } from './plugin-settings-tab-base.ts';

/**
 * Extracts the plugin from the plugin types.
 *
 * @deprecated Use `PluginBase` directly — PluginBase is no longer generic.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPlugin<PluginTypes extends PluginTypesBase> = PluginTypes['plugin'];

/**
 * Extracts the plugin settings from the plugin types.
 *
 * @deprecated Use the settings type directly.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettings<PluginTypes extends PluginTypesBase> = PluginTypes['pluginSettings'];

/**
 * Extracts the plugin settings manager from the plugin types.
 *
 * @deprecated Use `PluginSettingsComponentBase<YourSettings>` directly.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsManager<PluginTypes extends PluginTypesBase> = PluginTypes['pluginSettingsManager'];

/**
 * Extracts the plugin settings property names from the plugin types.
 *
 * @deprecated Use `StringKeys<YourSettings>` directly.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsPropertyNames<PluginTypes extends PluginTypesBase> = StringKeys<ExtractPluginSettings<PluginTypes>>;

/**
 * Extracts the plugin settings property values from the plugin types.
 *
 * @deprecated Use `PropertyValues<YourSettings>` directly.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsPropertyValues<PluginTypes extends PluginTypesBase> = PropertyValues<ExtractPluginSettings<PluginTypes>>;

/**
 * Extracts the plugin settings wrapper from the plugin types.
 *
 * @deprecated Use `PluginSettingsState<YourSettings>` directly.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsState<PluginTypes extends PluginTypesBase> = PluginSettingsState<ExtractPluginSettings<PluginTypes>>;

/**
 * Extracts the plugin settings tab from the plugin types.
 *
 * @deprecated Use `PluginSettingsTabBase<YourSettings>` directly.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsTab<PluginTypes extends PluginTypesBase> = PluginTypes['pluginSettingsTab'];

/**
 * Extracts the readonly plugin settings wrapper from the plugin types.
 *
 * @deprecated Use `ReadonlyPluginSettingsState<YourSettings>` directly.
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractReadonlyPluginSettingsState<PluginTypes extends PluginTypesBase> = ReadonlyPluginSettingsState<ExtractPluginSettings<PluginTypes>>;

/**
 * A base type for plugin types.
 *
 * @deprecated The PluginTypes pattern is no longer needed. PluginBase is non-generic.
 */
export interface PluginTypesBase {
  /**
   * Default translations.
   */
  defaultTranslations: DefaultTranslationsBase;

  /**
   * A plugin.
   */
  plugin: PluginBase;

  /**
   * A plugin settings.
   */
  pluginSettings: object;

  /**
   * A plugin settings manager.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Backward compatibility.
  pluginSettingsManager: PluginSettingsComponentBase<any>;

  /**
   * A plugin settings tab.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Backward compatibility.
  pluginSettingsTab: PluginSettingsTabBase<any>;
}
/* eslint-enable @typescript-eslint/no-deprecated -- Re-enable after deprecated type definitions. */

/* v8 ignore stop */
