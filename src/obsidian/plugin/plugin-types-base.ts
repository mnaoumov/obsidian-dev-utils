/**
 * @file
 *
 * Types helpers for plugin types.
 */

/* v8 ignore start -- Interface-only module; no runtime code to test. */

import type { ReadonlyDeep } from 'type-fest';

import type {
  PropertyValues,
  StringKeys
} from '../../type.ts';
import type { DefaultTranslationsBase } from '../i18n/default-translations-base.ts';
import type { PluginBase } from './plugin-base.ts';
import type { PluginSettingsManagerBase } from './plugin-settings-manager-base.ts';
import type { PluginSettingsTabBase } from './plugin-settings-tab-base.ts';
import type { PluginSettingsWrapper } from './plugin-settings-wrapper.ts';

/**
 * Extracts the plugin from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPlugin<PluginTypes extends PluginTypesBase> = PluginTypes['plugin'];

/**
 * Extracts the plugin settings from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettings<PluginTypes extends PluginTypesBase> = PluginTypes['pluginSettings'];

/**
 * Extracts the plugin settings manager from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsManager<PluginTypes extends PluginTypesBase> = PluginTypes['pluginSettingsManager'];

/**
 * Extracts the plugin settings property names from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsPropertyNames<PluginTypes extends PluginTypesBase> = StringKeys<ExtractPluginSettings<PluginTypes>>;

/**
 * Extracts the plugin settings property values from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsPropertyValues<PluginTypes extends PluginTypesBase> = PropertyValues<ExtractPluginSettings<PluginTypes>>;

/**
 * Extracts the plugin settings tab from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsTab<PluginTypes extends PluginTypesBase> = PluginTypes['pluginSettingsTab'];

/**
 * Extracts the plugin settings wrapper from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractPluginSettingsWrapper<PluginTypes extends PluginTypesBase> = PluginSettingsWrapper<ExtractPluginSettings<PluginTypes>>;

/**
 * Extracts the readonly plugin settings wrapper from the plugin types.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export type ExtractReadonlyPluginSettingsWrapper<PluginTypes extends PluginTypesBase> = ReadonlyDeep<ExtractPluginSettingsWrapper<PluginTypes>>;

/**
 * A base type for plugin types.
 *
 * An interface is used only for type inference.
 */
export interface PluginTypesBase {
  /**
   * Default translations.
   */
  defaultTranslations: DefaultTranslationsBase;

  /**
   * A plugin.
   */
  plugin: PluginBase<PluginTypesBase>;

  /**
   * A plugin settings.
   */
  pluginSettings: object;

  /**
   * A plugin settings manager.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `unknown`, `PluginTypeBase` don't work, getting compiler errors.
  pluginSettingsManager: PluginSettingsManagerBase<any>;

  /**
   * A plugin settings tab.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `unknown`, `PluginTypeBase` don't work, getting compiler errors.
  pluginSettingsTab: PluginSettingsTabBase<any>;
}

/* v8 ignore stop */
