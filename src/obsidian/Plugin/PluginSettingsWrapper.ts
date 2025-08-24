/**
 * @packageDocumentation
 *
 * Plugin settings wrapper.
 */

import type { StringKeys } from '../../Type.ts';

/**
 * A wrapper for plugin settings.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
export interface PluginSettingsWrapper<PluginSettings extends object> {
  /**
   * Safe settings.
   */
  safeSettings: PluginSettings;

  /**
   * Possibly unsafe settings.
   */
  settings: PluginSettings;

  /**
   * A validation messages.
   */
  validationMessages: Record<StringKeys<PluginSettings>, string>;
}
