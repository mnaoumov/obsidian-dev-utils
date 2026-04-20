/**
 * @file
 *
 * Component that initializes i18n translations.
 */

import type { TranslationsMap } from '../../i18n/i18n.ts';

import { AsyncComponentBase } from '../../components/async-component.ts';
import { initI18N } from '../../i18n/i18n.ts';
import { defaultTranslationsMap } from '../../i18n/locales/translations-map.ts';

/**
 * Initializes the i18n module with the provided translations map.
 */
export class I18nComponent extends AsyncComponentBase {
  /**
   * The singleton key for the {@link I18nComponent} class.
   */
  public static readonly COMPONENT_KEY = Symbol(I18nComponent.name);

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
  public override async onload(): Promise<void> {
    await initI18N(this.translationsMap);
  }
}
