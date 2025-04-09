/**
 * @packageDocumentation
 *
 * Plugin settings wrapper.
 */

import type { StringKeys } from '../../Type.ts';

/**
 * Represents a wrapper for plugin settings.
 *
 * @typeParam PluginSettings - The type of the plugin settings.
 */
export interface PluginSettingsWrapper<PluginSettings extends object> {
  /**
   * The safe settings.
   */
  safeSettings: PluginSettings;

  /**
   * The settings.
   */
  settings: PluginSettings;

  /**
   * The validation messages.
   */
  validationMessages: Record<StringKeys<PluginSettings>, string>;
}
