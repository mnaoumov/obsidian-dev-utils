// @vitest-environment jsdom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

import {
  noop,
  noopAsync
} from '../function.ts';
import { castTo } from '../object-utils.ts';
import {
  assertNonNullable,
  ensureGenericObject
} from '../type-guards.ts';
import { DEFAULT_NS } from './i18n/i18n.ts';

const HEAVY_IMPORT_TIMEOUT = 30_000;

const {
  mockAddResourceBundleFn,
  mockI18nextInstance,
  mockInitFn,
  mockTLibFn
} = vi.hoisted(() => {
  const mockAddResourceBundleFunction2 = vi.fn();
  // Mirrors i18next: `init()` flips `isInitialized`, which the real code reads as the single source of truth.
  const mockI18nextInstance2 = {
    addResourceBundle: mockAddResourceBundleFunction2,
    isInitialized: false
  };
  const mockInitFunction2 = vi.fn(() => {
    mockI18nextInstance2.isInitialized = true;
    return noopAsync();
  });
  const mockTLibFunction2 = vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (translations: Record<string, unknown>) => unknown)({ test: 'translated-value' });
    }
    return 'mock-translated';
  });
  return {
    mockAddResourceBundleFn: mockAddResourceBundleFunction2,
    mockI18nextInstance: mockI18nextInstance2,
    mockInitFn: mockInitFunction2,
    mockTLibFn: mockTLibFunction2
  };
});

vi.mock('i18next', () => ({
  default: mockI18nextInstance,
  i18next: mockI18nextInstance,
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

vi.mock('../obsidian/i18n/locales/en.ts', () => ({
  en: { obsidianDevUtils: { test: 'english-value' } }
}));

vi.mock('../obsidian/i18n/locales/translations-map.ts', () => ({
  DEFAULT_LANGUAGE: 'en',
  defaultTranslationsMap: { en: { obsidianDevUtils: { test: 'english-value' } } }
}));

async function reloadI18N(): Promise<typeof import('./i18n/i18n.ts')> {
  return await import('./i18n/i18n.ts');
}

describe('i18n module', { timeout: HEAVY_IMPORT_TIMEOUT }, () => {
  beforeEach(() => {
    mockI18nextInstance.isInitialized = false;
  });

  describe('DEFAULT_NS', () => {
    it('should export DEFAULT_NS as "translation"', async () => {
      await noopAsync();
      expect(DEFAULT_NS).toBe('translation');
    });
  });

  describe('t function auto-initialization', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it('should report to the library debug namespace and auto-initialize when not initialized', async () => {
      vi.spyOn(console, 'debug').mockImplementation(() => {
        noop();
      });

      // The debug module must come from the SAME freshly-reset module registry as the reloaded i18n
      // Module, so both share one debug instance and one shared-state bag.
      const { enableLibraryDebuggers } = await import('../debug.ts');
      enableLibraryDebuggers();
      const { t: freshT } = await reloadI18N();

      freshT(castTo<Parameters<typeof freshT>[0]>((translations: GenericObject) => translations['test']));

      // eslint-disable-next-line no-console -- Valid usage.
      const callArguments = vi.mocked(console.debug).mock.calls[0];
      assertNonNullable(callArguments);
      // The debug library prefixes the namespace onto the message, so match on the message itself.
      expect(callArguments[0]).toContain('I18N was not initialized, initializing default obsidian-dev-utils translations');
      // The real invokeAsyncSafely runs the fire-and-forget initI18N synchronously up to its first
      // Await, so the observable effect of auto-initialization is that init() was called once.
      expect(mockInitFn).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line no-console -- Valid usage.
      vi.mocked(console.debug).mockRestore();
    });

    it('should print nothing when the library debug namespaces are disabled', async () => {
      vi.spyOn(console, 'debug').mockImplementation(() => {
        noop();
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {
        noop();
      });

      const { getDebugController } = await import('../debug.ts');
      getDebugController().set('');
      const { t: freshT } = await reloadI18N();

      freshT(castTo<Parameters<typeof freshT>[0]>((translations: GenericObject) => translations['test']));

      // eslint-disable-next-line no-console -- Valid usage.
      expect(vi.mocked(console.debug)).not.toHaveBeenCalled();
      expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
      // Auto-initialization still happens - it is only the diagnostic that stays silent.
      expect(mockInitFn).toHaveBeenCalledTimes(1);

      // eslint-disable-next-line no-console -- Valid usage.
      vi.mocked(console.debug).mockRestore();
      vi.mocked(console.warn).mockRestore();
    });
  });

  describe('initI18N', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it('should call init with correct options', async () => {
      const { initI18N } = await reloadI18N();
      const translationsMap = { en: { greeting: 'Hello' } };

      await initI18N(translationsMap, false);

      expect(mockInitFn).toHaveBeenCalledTimes(1);
      const callArguments = (mockInitFn.mock.calls[0] as unknown[])[0] as object;
      expect(callArguments).toMatchObject({
        fallbackLng: 'en',
        initAsync: false,
        interpolation: { escapeValue: false },
        lng: 'en',
        returnEmptyString: false,
        returnNull: false
      });
    });

    it('should structure resources with DEFAULT_NS as key', async () => {
      const { initI18N } = await reloadI18N();
      const translationsMap = { en: { greeting: 'Hello' }, fr: { greeting: 'Bonjour' } };

      await initI18N(translationsMap, false);

      expect(mockInitFn).toHaveBeenCalledTimes(1);
      const callArguments = ensureGenericObject((mockInitFn.mock.calls[0] as unknown[])[0]);
      expect(callArguments['resources']).toEqual({
        en: { translation: { greeting: 'Hello' } },
        fr: { translation: { greeting: 'Bonjour' } }
      });
    });

    it('should add en resource bundle after init', async () => {
      const { initI18N } = await reloadI18N();

      await initI18N({ en: { test: 'value' } }, false);

      expect(mockAddResourceBundleFn).toHaveBeenCalledWith(
        'en',
        'translation',
        { obsidianDevUtils: { test: 'english-value' } },
        true,
        false
      );
    });

    it('should re-initialize on every call so a reload picks up changes', async () => {
      const { initI18N } = await reloadI18N();

      await initI18N({ en: { test: 'value' } }, false);
      expect(mockInitFn).toHaveBeenCalledTimes(1);

      await initI18N({ en: { test: 'other-value' } }, false);
      expect(mockInitFn).toHaveBeenCalledTimes(2);
    });

    it('should default isAsync to true', async () => {
      const { initI18N } = await reloadI18N();

      await initI18N({ en: { test: 'value' } });

      expect(mockInitFn).toHaveBeenCalledTimes(1);
      const callArguments = ensureGenericObject((mockInitFn.mock.calls[0] as unknown[])[0]);
      expect(callArguments['initAsync']).toBe(true);
    });
  });

  describe('t function', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it('should call tLib with selector when no options provided', async () => {
      const { initI18N, t: freshT } = await reloadI18N();
      await initI18N({ en: { test: 'hello' } }, false);
      mockTLibFn.mockClear();

      const selector = castTo<Parameters<typeof freshT>[0]>(($: GenericObject): unknown => $['test']);
      freshT(selector);

      expect(mockTLibFn).toHaveBeenCalledTimes(1);
      expect(mockTLibFn).toHaveBeenCalledWith(selector);
    });

    it('should call tLib with selector and options when options provided', async () => {
      const { initI18N, t: freshT } = await reloadI18N();
      await initI18N({ en: { test: 'hello' } }, false);
      mockTLibFn.mockClear();

      const selector = castTo<Parameters<typeof freshT>[0]>(($: GenericObject): unknown => $['test']);
      const options = { ns: ['translation' as const] };
      freshT(selector, castTo<Parameters<typeof freshT>[1]>(options));

      expect(mockTLibFn).toHaveBeenCalledTimes(1);
      expect(mockTLibFn).toHaveBeenCalledWith(selector, options);
    });

    it('should return the translated value from tLib', async () => {
      const { initI18N, t: freshT } = await reloadI18N();
      await initI18N({ en: { test: 'hello' } }, false);

      const result = freshT(castTo<Parameters<typeof freshT>[0]>(($: GenericObject): unknown => $['test']));

      expect(result).toBe('translated-value');
    });
  });
});
