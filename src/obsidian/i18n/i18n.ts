/**
 * @packageDocumentation
 *
 * This file defines the `i18n` module for `i18next`.
 */

import type {
  SelectorFn,
  SelectorOptions,
  TFunction
} from 'i18next';
import type {
  LiteralToPrimitiveDeep,
  PartialDeep,
  ReadonlyDeep
} from 'type-fest';

import {
  i18next,
  init,
  t as tLib
} from 'i18next';
import { getLanguage } from 'obsidian';

import type { PluginTypesBase } from '../Plugin/PluginTypesBase.ts';

import { invokeAsyncSafely } from '../../Async.ts';
import { en } from './locales/en.ts';
import {
  DEFAULT_LANGUAGE,
  defaultTranslationsMap
} from './locales/translationsMap.ts';

/**
 * The default namespace.
 */
export const DEFAULT_NS = 'translation';

/**
 * The full translations.
 */
export type FullTranslations<PluginTypes extends PluginTypesBase> = LiteralToPrimitiveDeep<PluginTypes['defaultTranslations']>;

/**
 * The translations.
 */
export type Translations<PluginTypes extends PluginTypesBase> = PartialDeep<FullTranslations<PluginTypes>>;

/**
 * The translations map.
 */
export type TranslationsMap<PluginTypes extends PluginTypesBase> = Record<string, Translations<PluginTypes>>;

let isInitialized = false;

/**
 * Initializes the `i18n` module.
 *
 * @typeParam PluginTypes - The plugin types.
 * @param translationsMap - The translations map.
 * @param isAsync - Whether the initialization is asynchronous.
 * @returns A {@link Promise} that resolves when the `i18n` module is initialized.
 */
export async function initI18N<PluginTypes extends PluginTypesBase>(translationsMap: TranslationsMap<PluginTypes>, isAsync = true): Promise<void> {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  await init({
    fallbackLng: DEFAULT_LANGUAGE,
    initAsync: isAsync,
    interpolation: {
      escapeValue: false
    },
    lng: getLanguage(),
    resources: Object.fromEntries(
      Object.entries(translationsMap).map(([language, translations]) => [
        language,
        {
          [DEFAULT_NS]: translations as PluginTypes['defaultTranslations']
        }
      ])
    ),
    returnEmptyString: false,
    returnNull: false
  });

  i18next.addResourceBundle(DEFAULT_LANGUAGE, DEFAULT_NS, en, true, false);
}

function tImpl(
  selector: SelectorFn<ReadonlyDeep<Translations<PluginTypesBase>>, string, SelectorOptions<[typeof DEFAULT_NS]>>,
  options?: { ns: [typeof DEFAULT_NS] } & SelectorOptions<[typeof DEFAULT_NS]>
): string {
  if (!isInitialized) {
    console.warn('I18N was not initialized, initializing default obsidian-dev-utils translations');
    invokeAsyncSafely(() => initI18N(defaultTranslationsMap, false));
  }

  if (!options) {
    return tLib(selector);
  }

  return tLib(selector, options);
}

/**
 * The `t` function.
 */
export const t = tImpl as TFunction;
