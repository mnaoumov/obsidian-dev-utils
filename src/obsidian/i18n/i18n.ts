/**
 * @file
 *
 * This file defines the `i18n` module for `i18next`.
 */

import type {
  SelectorFn,
  SelectorOptions,
  TFunction
} from 'i18next';
import type { ReadonlyDeep } from 'type-fest';

import i18next, {
  init,
  t as tLib
} from 'i18next';
import { getLanguage } from 'obsidian';

import type { DefaultTranslationsBase } from './default-translations.ts';

import { invokeAsyncSafely } from '../../async.ts';
import { en } from './locales/en.ts';
import {
  DEFAULT_LANGUAGE,
  defaultTranslationsMap
} from './locales/translations-map.ts';

/**
 * The default namespace.
 */
export const DEFAULT_NS = 'translation';

/**
 * The translations map.
 */
export type TranslationsMap = Record<string, Record<string, unknown>>;

let isInitialized = false;

interface TOptions extends SelectorOptions<[typeof DEFAULT_NS]> {
  readonly ns: [typeof DEFAULT_NS];
}

/**
 * Initializes the `i18n` module.
 *
 * @param translationsMap - The translations map.
 * @param isAsync - Whether the initialization is asynchronous.
 * @returns A {@link Promise} that resolves when the `i18n` module is initialized.
 */
export async function initI18N(translationsMap: TranslationsMap, isAsync = true): Promise<void> {
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
          [DEFAULT_NS]: translations
        }
      ])
    ),
    returnEmptyString: false,
    returnNull: false
  });

  i18next.addResourceBundle(DEFAULT_LANGUAGE, DEFAULT_NS, en, true, false);
}

function tImpl(
  selector: SelectorFn<ReadonlyDeep<DefaultTranslationsBase>, string, SelectorOptions<[typeof DEFAULT_NS]>>,
  options?: TOptions
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
