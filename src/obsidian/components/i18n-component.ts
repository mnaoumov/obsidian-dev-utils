/**
 * @file
 *
 * Component that initializes i18n translations.
 */

import type { TranslationsMap } from '../i18n/i18n.ts';

import { initI18N } from '../i18n/i18n.ts';
import { defaultTranslationsMap } from '../i18n/locales/translations-map.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * Initializes the i18n module with the provided translations map.
 */
export class I18nComponent extends ComponentEx {
  /**
   * Creates a new i18n component.
   *
   * @param translationsMap - The translations map. Defaults to the built-in translations.
   */
  public constructor(private readonly translationsMap: TranslationsMap = defaultTranslationsMap) {
    super();
  }

  /**
   * Initializes i18n.
   */
  public override async onloadAsync(): Promise<void> {
    await initI18N(this.translationsMap);
  }
}
