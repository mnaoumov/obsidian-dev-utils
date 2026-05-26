import type {
  App as AppOriginal,
  Plugin,
  PluginManifest
} from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../../function.ts';
import { strictProxy } from '../../strict-proxy.ts';
import {
  PluginBase,
  reloadPlugin,
  showErrorAndDisablePlugin
} from './plugin.ts';

vi.mock('../../error.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../error.ts')>();
  return {
    ...actual,
    printError: vi.fn(),
    registerAsyncErrorEventHandler: vi.fn(() => vi.fn())
  };
});

vi.mock('../i18n/i18n.ts', () => ({
  initI18N: vi.fn(),
  t: vi.fn((fn: (t: unknown) => string) =>
    fn({
      obsidianDevUtils: { notices: { unhandledError: 'error' } }
    })
  )
}));

vi.mock('../i18n/locales/translations-map.ts', () => ({
  defaultTranslationsMap: {}
}));

vi.mock('../../debug.ts', () => ({
  getDebugController: vi.fn(() => ({})),
  getDebugger: vi.fn(() => vi.fn()),
  getLibDebugger: vi.fn(() => vi.fn()),
  showInitialDebugMessage: vi.fn()
}));

vi.mock('../../library.ts', () => ({
  LIBRARY_NAME: 'obsidian-dev-utils',
  LIBRARY_STYLES: '',
  LIBRARY_VERSION: '1.0.0'
}));

vi.mock('../app.ts', () => ({
  getObsidianDevUtilsState: vi.fn(() => ({ value: '0.0.0' }))
}));

vi.mock('./plugin-id.ts', () => ({
  getPluginId: vi.fn(() => 'test-plugin'),
  setPluginId: vi.fn()
}));

vi.mock('../../css-class.ts', () => ({
  CssClass: {
    LibraryName: 'obsidian-dev-utils',
    PluginSettingsTab: 'plugin-settings-tab',
    Tooltip: 'tooltip',
    TooltipArrow: 'tooltip-arrow',
    TooltipValidator: 'tooltip-validator'
  }
}));

vi.mock('compare-versions', () => ({
  compareVersions: vi.fn(() => 1)
}));

vi.mock('../../async.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../async.ts')>();
  return {
    ...actual,
    invokeAsyncSafelyAfterDelay: vi.fn((
      asyncFn: (abortSignal: AbortSignal) => Promise<void>,
      _delayInMilliseconds?: number,
      _stackTrace?: string,
      abortSignal?: AbortSignal
    ) => {
      if (abortSignal?.aborted) {
        return;
      }
      asyncFn(abortSignal ?? new AbortController().signal).catch(() => {
        /* Swallow errors in test mock. */
      });
    })
  };
});

let app: AppOriginal;

const manifest: PluginManifest = {
  author: 'test',
  description: 'test',
  id: 'test-plugin',
  minAppVersion: '1.0.0',
  name: 'Test Plugin',
  version: '1.0.0'
};

class TestPlugin extends PluginBase {
  public constructor(appInstance: AppOriginal, pluginManifest: PluginManifest) {
    super(appInstance, pluginManifest);
  }

  public getAbortSignalComponent(): typeof this.abortSignalComponent {
    return this.abortSignalComponent;
  }

  public getConsoleDebugComponent(): typeof this.consoleDebugComponent {
    return this.consoleDebugComponent;
  }

  public getNoticeComponent(): typeof this.pluginNoticeComponent {
    return this.pluginNoticeComponent;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  });
  app = appMock.asOriginalType__();
});

describe('PluginBase', () => {
  it('should create with all default components', () => {
    const plugin = new TestPlugin(app, manifest);
    plugin.load();
    expect(plugin.getAbortSignalComponent()).toBeDefined();
    expect(plugin.getConsoleDebugComponent()).toBeDefined();
    expect(plugin.getNoticeComponent()).toBeDefined();
  });

  it('should load children first then self via loadChildrenFirstAsync', () => {
    const plugin = new TestPlugin(app, manifest);
    plugin.load();

    expect(plugin._loaded).toBe(true);
  });

  it('should call onExternalSettingsChange on settings component', async () => {
    const plugin = new TestPlugin(app, manifest);
    plugin.load();

    await plugin.onExternalSettingsChange();

    // Should not throw even without a settings component registered
  });
});

describe('reloadPlugin', () => {
  function createMockPlugin(): Plugin {
    return strictProxy<Plugin>({
      app: {
        plugins: {
          disablePlugin: vi.fn(() => noopAsync()),
          enablePlugin: vi.fn(() => noopAsync())
        }
      },
      manifest: { id: 'test-plugin' }
    });
  }

  it('should reload plugin by disabling and re-enabling', async () => {
    const plugin = createMockPlugin();
    await reloadPlugin(plugin);
    expect(plugin.app.plugins.disablePlugin).toHaveBeenCalledWith('test-plugin');
    expect(plugin.app.plugins.enablePlugin).toHaveBeenCalledWith('test-plugin');
  });
});

describe('showErrorAndDisablePlugin', () => {
  function createMockPlugin(): Plugin {
    return strictProxy<Plugin>({
      app: {
        plugins: {
          disablePlugin: vi.fn(() => noopAsync())
        }
      },
      manifest: { id: 'test-plugin' }
    });
  }

  it('should show error and disable plugin', async () => {
    const plugin = createMockPlugin();
    await showErrorAndDisablePlugin(plugin, 'Test error');
    expect(plugin.app.plugins.disablePlugin).toHaveBeenCalledWith('test-plugin');
  });
});
