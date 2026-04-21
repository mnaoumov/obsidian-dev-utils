import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { I18nComponent } from './i18n-component.ts';

const mocks = vi.hoisted(() => ({
  defaultTranslationsMap: { en: {} },
  initI18N: vi.fn()
}));

vi.mock('../../i18n/i18n.ts', () => ({
  initI18N: mocks.initI18N
}));

vi.mock('../../i18n/locales/translations-map.ts', () => ({
  defaultTranslationsMap: mocks.defaultTranslationsMap
}));

describe('I18nComponent', () => {
  it('should initialize i18n with default translations on load', async () => {
    const component = new I18nComponent();
    await component.onload();
    expect(mocks.initI18N).toHaveBeenCalledWith(mocks.defaultTranslationsMap);
  });

  it('should initialize i18n with custom translations on load', async () => {
    const customMap = { fr: { hello: 'bonjour' } };
    const component = new I18nComponent(customMap);
    await component.onload();
    expect(mocks.initI18N).toHaveBeenCalledWith(customMap);
  });
});
