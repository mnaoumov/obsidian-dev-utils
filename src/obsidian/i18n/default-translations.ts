/**
 * @file
 *
 * This file defines a default translations base for `i18next`.
 */

/* v8 ignore start -- Interface-only module; no runtime code to test. */

import { en } from './locales/en.ts';

/**
 * A default translations base for `i18next`.
 */
export type DefaultTranslationsBase = TranslationKeyMap & typeof en;

type TranslationKey = string | TranslationKeyMap;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- We cannot inline `TranslationKeyMap`, so we need to extract it even if it is empty.
interface TranslationKeyMap extends Record<string, TranslationKey> {}

/* v8 ignore stop */
