/**
 * @packageDocumentation
 *
 * This file defines a custom type options base for `i18next`.
 */

/* v8 ignore start -- Interface-only module; no runtime code to test. */

import type { PluginTypesBase } from '../plugin/plugin-types-base.ts';

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
  resources: CustomTypeOptionsResources<PluginTypes>;
}

/**
 * The resources for `i18next` custom type options.
 *
 * @typeParam PluginTypes - The plugin types.
 */
export interface CustomTypeOptionsResources<PluginTypes extends PluginTypesBase> {
  /**
   * The default namespace.
   */
  [DEFAULT_NS]: PluginTypes['defaultTranslations'];
}

/* v8 ignore stop */
