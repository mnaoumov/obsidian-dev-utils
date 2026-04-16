/**
 * @file
 *
 * This file defines a custom type options base for `i18next`.
 */

/* v8 ignore start -- Interface-only module; no runtime code to test. */

import type { DefaultTranslationsBase } from './default-translations-base.ts';

import { DEFAULT_NS } from './i18n.ts';

/**
 * A custom type options base for `i18next`.
 *
 * @typeParam DefaultTranslations - The default translations type.
 */
export interface CustomTypeOptionsBase<DefaultTranslations extends DefaultTranslationsBase> {
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
  resources: CustomTypeOptionsResources<DefaultTranslations>;
}

/**
 * The resources for `i18next` custom type options.
 *
 * @typeParam DefaultTranslations - The default translations type.
 */
export interface CustomTypeOptionsResources<DefaultTranslations extends DefaultTranslationsBase> {
  /**
   * The default namespace.
   */
  [DEFAULT_NS]: DefaultTranslations;
}

/* v8 ignore stop */
