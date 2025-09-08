/**
 * @packageDocumentation
 *
 * This file defines the `i18next` type options for the `obsidian` module.
 */

import type { CustomTypeOptionsBase } from '../i18n/CustomTypeOptionsBase.ts';
import type { DefaultPluginTypes } from '../i18n/DefaultTranslationsBase.ts';

declare module 'i18next' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface CustomTypeOptions extends CustomTypeOptionsBase<DefaultPluginTypes> {}
}
