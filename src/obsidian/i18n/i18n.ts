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
import { getLibDebugger } from '../../debug.ts';
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

interface TOptions extends SelectorOptions<[typeof DEFAULT_NS]> {
  readonly ns: [typeof DEFAULT_NS];
}

/**
 * Initializes the `i18n` module.
 *
 * Calling this again re-runs `i18next.init()`, which fully replaces the resource store and language, so a reload picks
 * up a changed language or translations map. The lazy fallback in {@link t} and external callers rely on
 * `i18next.isInitialized` (set by `i18next.init()`) as the single source of truth, so no separate guard is kept here.
 *
 * @param translationsMap - The translations map.
 * @param isAsync - Whether the initialization is asynchronous.
 * @returns A {@link Promise} that resolves when the `i18n` module is initialized.
 */
export async function initI18N(translationsMap: TranslationsMap, isAsync = true): Promise<void> {
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
  if (!i18next.isInitialized) {
    getLibDebugger('I18N:t')('I18N was not initialized, initializing default obsidian-dev-utils translations');
    invokeAsyncSafely(() => initI18N(defaultTranslationsMap, false));
  }

  if (!options) {
    return tLib(selector);
  }

  return tLib(selector, options);
}

/**
 * The `t` function.
 *
 * If {@link initI18N} has not been called yet — which is the case for a plugin that extends Obsidian's raw `Plugin`
 * instead of `PluginBase`, since `PluginBase.onload` is the only caller of {@link initI18N} — the first call lazily
 * initializes the default `obsidian-dev-utils` translations and still returns the correct string. That fallback is a
 * supported path, so it is reported through the `obsidian-dev-utils:I18N:t` debug namespace rather than the console:
 * it stays silent unless debug messages are enabled. See
 * {@link https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/}.
 */
export const t = tImpl as TFunction;
