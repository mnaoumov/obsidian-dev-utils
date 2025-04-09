/**
 * @packageDocumentation
 *
 * Types helpers for plugin types.
 */

import type { ReadonlyDeep } from 'type-fest';

import type {
  PropertyValues,
  StringKeys
} from '../../Type.ts';
import type { PluginBase } from './PluginBase.ts';
import type { PluginSettingsManagerBase } from './PluginSettingsManagerBase.ts';
import type { PluginSettingsTabBase } from './PluginSettingsTabBase.ts';
import type { PluginSettingsWrapper } from './PluginSettingsWrapper.ts';

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
 * The base type for plugin types.
 *
 * The interface is used only for type inference.
 */
export interface PluginTypesBase {
  /**
   * The plugin.
   */
  plugin: PluginBase<PluginTypesBase>;
  /**
   * The plugin settings.
   */
  pluginSettings: object;
  /**
   * The plugin settings manager.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pluginSettingsManager: PluginSettingsManagerBase<any>;
  /**
   * The plugin settings tab.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pluginSettingsTab: PluginSettingsTabBase<any>;
}
