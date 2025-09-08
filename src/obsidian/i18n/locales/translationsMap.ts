/**
 * @packageDocumentation
 *
 * This file defines the translations map for the `i18n` module.
 */

import type { PluginTypesBase } from '../../Plugin/PluginTypesBase.ts';
import type { TranslationsMap } from '../i18n.ts';

import { en } from './en.ts';

/**
 * The default language.
 */
export const DEFAULT_LANGUAGE: keyof typeof translationsMapImpl = 'en';

const translationsMapImpl = {
  en
} as const;

/**
 * The default translations map.
 */
export const defaultTranslationsMap: TranslationsMap<PluginTypesBase> = translationsMapImpl;
