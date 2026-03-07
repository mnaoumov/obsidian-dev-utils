// @vitest-environment jsdom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../../src/type-guards.ts';

import {
  noop,
  noopAsync
} from '../../src/function.ts';
import { ensureGenericObject } from '../../src/type-guards.ts';

const HEAVY_IMPORT_TIMEOUT = 30_000;

const mockAddResourceBundleFn = vi.fn();
const mockInitFn = vi.fn(noopAsync);
const mockTLibFn = vi.fn((selector: unknown) => {
  if (typeof selector === 'function') {
    return (selector as (translations: GenericObject) => unknown)({ test: 'translated-value' });
  }
  return 'mock-translated';
});
const mockInvokeAsyncSafelyFn = vi.fn((fn: () => Promise<unknown>) => {
  fn().then(noop, noop);
});

vi.mock('i18next', () => ({
  default: {
    addResourceBundle: mockAddResourceBundleFn
  },
  i18next: {
    addResourceBundle: mockAddResourceBundleFn
  },
  init: mockInitFn,
  t: mockTLibFn
}));

vi.mock('obsidian', async () => {
  const actual = await vi.importActual('obsidian');
  return {
    ...(actual as object),
    getLanguage: vi.fn(() => 'en')
  };
});

vi.mock('../../src/async.ts', () => ({
  invokeAsyncSafely: mockInvokeAsyncSafelyFn
}));

vi.mock('../../src/obsidian/i18n/locales/en.ts', () => ({
  en: { obsidianDevUtils: { test: 'english-value' } }
}));

vi.mock('../../src/obsidian/i18n/locales/translationsMap.ts', () => ({
  DEFAULT_LANGUAGE: 'en',
  defaultTranslationsMap: { en: { obsidianDevUtils: { test: 'english-value' } } }
}));

describe('i18n module', () => {
  describe('DEFAULT_NS', () => {
    it('should export DEFAULT_NS as "translation"', async () => {
      const { DEFAULT_NS } = await import('../../src/obsidian/i18n/i18n.ts');
      expect(DEFAULT_NS).toBe('translation');
    }, HEAVY_IMPORT_TIMEOUT);
  });

  describe('t function auto-initialization', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it('should warn and auto-initialize when not initialized', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {
        noop();
      });

      const { t: freshT } = await import('../../src/obsidian/i18n/i18n.ts');

      freshT(((translations: GenericObject) => translations['test']) as never);

      expect(vi.mocked(console.warn)).toHaveBeenCalledWith(
        'I18N was not initialized, initializing default obsidian-dev-utils translations'
      );
      expect(mockInvokeAsyncSafelyFn).toHaveBeenCalledTimes(1);

      vi.mocked(console.warn).mockRestore();
    });
  });

  describe('initI18N', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it('should call init with correct options', async () => {
      const { initI18N } = await import('../../src/obsidian/i18n/i18n.ts');
      const translationsMap = { en: { greeting: 'Hello' } };

      await initI18N(translationsMap as never, false);

      expect(mockInitFn).toHaveBeenCalledTimes(1);
      const callArgs = ensureGenericObject((mockInitFn.mock.calls[0] as unknown[])[0] as object);
      expect(callArgs).toMatchObject({
        fallbackLng: 'en',
        initAsync: false,
        interpolation: { escapeValue: false },
        lng: 'en',
        returnEmptyString: false,
        returnNull: false
      });
    });

    it('should structure resources with DEFAULT_NS as key', async () => {
      const { initI18N } = await import('../../src/obsidian/i18n/i18n.ts');
      const translationsMap = { en: { greeting: 'Hello' }, fr: { greeting: 'Bonjour' } };

      await initI18N(translationsMap as never, false);

      expect(mockInitFn).toHaveBeenCalledTimes(1);
      const callArgs = ensureGenericObject((mockInitFn.mock.calls[0] as unknown[])[0] as object);
      expect(callArgs['resources']).toEqual({
        en: { translation: { greeting: 'Hello' } },
        fr: { translation: { greeting: 'Bonjour' } }
      });
    });

    it('should add en resource bundle after init', async () => {
      const { initI18N } = await import('../../src/obsidian/i18n/i18n.ts');
      await initI18N({ en: { test: 'value' } } as never, false);

      expect(mockAddResourceBundleFn).toHaveBeenCalledWith(
        'en',
        'translation',
        { obsidianDevUtils: { test: 'english-value' } },
        true,
        false
      );
    });

    it('should only initialize once (idempotent)', async () => {
      const { initI18N } = await import('../../src/obsidian/i18n/i18n.ts');
      await initI18N({ en: { test: 'value' } } as never, false);
      expect(mockInitFn).toHaveBeenCalledTimes(1);

      await initI18N({ en: { test: 'other-value' } } as never, false);
      expect(mockInitFn).toHaveBeenCalledTimes(1);
    });

    it('should default isAsync to true', async () => {
      const { initI18N } = await import('../../src/obsidian/i18n/i18n.ts');
      await initI18N({ en: { test: 'value' } } as never);

      expect(mockInitFn).toHaveBeenCalledTimes(1);
      const callArgs = ensureGenericObject((mockInitFn.mock.calls[0] as unknown[])[0] as object);
      expect(callArgs['initAsync']).toBe(true);
    });
  });

  describe('t function', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it('should call tLib with selector when no options provided', async () => {
      const { initI18N, t: tFn } = await import('../../src/obsidian/i18n/i18n.ts');
      await initI18N({ en: { test: 'hello' } } as never, false);
      mockTLibFn.mockClear();

      const selector = (($: GenericObject): unknown => $['test']) as never;
      tFn(selector);

      expect(mockTLibFn).toHaveBeenCalledTimes(1);
      expect(mockTLibFn).toHaveBeenCalledWith(selector);
    });

    it('should call tLib with selector and options when options provided', async () => {
      const { initI18N, t: tFn } = await import('../../src/obsidian/i18n/i18n.ts');
      await initI18N({ en: { test: 'hello' } } as never, false);
      mockTLibFn.mockClear();

      const selector = (($: GenericObject): unknown => $['test']) as never;
      const options = { ns: ['translation' as const] };
      tFn(selector, options as never);

      expect(mockTLibFn).toHaveBeenCalledTimes(1);
      expect(mockTLibFn).toHaveBeenCalledWith(selector, options);
    });

    it('should return the translated value from tLib', async () => {
      const { initI18N, t: tFn } = await import('../../src/obsidian/i18n/i18n.ts');
      await initI18N({ en: { test: 'hello' } } as never, false);

      const result = tFn((($: GenericObject): unknown => $['test']) as never);

      expect(result).toBe('translated-value');
    });
  });
});
