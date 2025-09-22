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

import i18next, {
  init,
  t as tLib
} from 'i18next';
import { getLanguage } from 'obsidian';

import type { PluginTypesBase } from '../Plugin/PluginTypesBase.ts';

import { en } from './locales/en.ts';
import { DEFAULT_LANGUAGE } from './locales/translationsMap.ts';

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
 * @returns A {@link Promise} that resolves when the `i18n` module is initialized.
 */
export async function initI18N<PluginTypes extends PluginTypesBase>(translationsMap: TranslationsMap<PluginTypes>): Promise<void> {
  if (isInitialized) {
    return;
  }

  await init({
    fallbackLng: DEFAULT_LANGUAGE,
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

  initDefault();
}

function initDefault(): void {
  i18next.addResourceBundle(DEFAULT_LANGUAGE, DEFAULT_NS, en, true, false);
  isInitialized = true;
}

function tImpl(
  selector: SelectorFn<ReadonlyDeep<Translations<PluginTypesBase>>, string, SelectorOptions<[typeof DEFAULT_NS]>>,
  options?: SelectorOptions<[typeof DEFAULT_NS]>
): string {
  if (!isInitialized) {
    console.warn('I18N was not initialized, initializing default obsidian-dev-utils translations');
    initDefault();
  }

  return tLib(selector, options);
}

/**
 * The `t` function.
 */
export const t = tImpl as TFunction;
