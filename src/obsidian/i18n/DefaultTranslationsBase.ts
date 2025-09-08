/**
 * @packageDocumentation
 *
 * This file defines a default translations base for `i18next`.
 */

import type { PluginTypesBase } from '../Plugin/PluginTypesBase.ts';
import type { Translations } from './i18n.ts';

import { en } from './locales/en.ts';

/**
 * A default plugin types for `i18next`.
 */
export interface DefaultPluginTypes extends PluginTypesBase {
  /**
   * The default translations.
   */
  defaultTranslations: typeof en;
}

/**
 * A default translations base for `i18next`.
 */
export type DefaultTranslationsBase = Translations<DefaultPluginTypes>;
