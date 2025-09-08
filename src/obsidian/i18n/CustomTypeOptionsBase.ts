/**
 * @packageDocumentation
 *
 * This file defines a custom type options base for `i18next`.
 */

import type { PluginTypesBase } from '../Plugin/PluginTypesBase.ts';

import { DEFAULT_NS } from './i18n.ts';

/**
 * A custom type options base for `i18next`.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export interface CustomTypeOptionsBase<PluginTypes extends PluginTypesBase> {
  /**
   * The default namespace.
   */
  defaultNS: typeof DEFAULT_NS;

  /**
   * Whether to enable the selector.
   */
  enableSelector: true;

  /**
   * The resources.
   */
  resources: {
    /**
     * The default namespace.
     */
    [DEFAULT_NS]: PluginTypes['defaultTranslations'];
  };
}
