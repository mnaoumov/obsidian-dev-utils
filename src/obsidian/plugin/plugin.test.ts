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

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { DisposableComponent } from '../components/disposable-component.ts';
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

  public getNoticeComponent(): typeof this.noticeComponent {
    return this.noticeComponent;
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
    expect(plugin.getAbortSignalComponent()).toBeDefined();
    expect(plugin.getConsoleDebugComponent()).toBeDefined();
    expect(plugin.getNoticeComponent()).toBeDefined();
  });

  it('should load children first then self via loadChildrenFirstAsync', async () => {
    const plugin = new TestPlugin(app, manifest);
    await plugin.load();

    expect(plugin._loaded).toBe(true);
  });

  it('should replace singleton component with same COMPONENT_KEY', () => {
    const KEY = Symbol('TestSingleton');

    class SingletonComponent1 extends DisposableComponent {
      public static readonly COMPONENT_KEY = KEY;
    }

    class SingletonComponent2 extends DisposableComponent {
      public static readonly COMPONENT_KEY = KEY;
    }

    const plugin = new TestPlugin(app, manifest);
    const component1 = new SingletonComponent1();
    const component2 = new SingletonComponent2();

    const result1 = plugin.addChild(component1);
    expect(result1).toBe(component1);

    const result2 = plugin.addChild(component2);
    expect(result2).toBe(component2);

    expect(plugin['singletonComponents'].get(KEY)).toBe(component2);
  });

  it('should not replace multi-instance components without COMPONENT_KEY', () => {
    const plugin = new TestPlugin(app, manifest);
    const component1 = new DisposableComponent();
    const component2 = new DisposableComponent();

    plugin.addChild(component1);
    plugin.addChild(component2);

    // Both should be added as children (not replaced)
    const children = plugin._children;
    expect(children).toContain(component1);
    expect(children).toContain(component2);
  });

  it('should handle singleton replacement during construction', () => {
    const KEY = Symbol('TestSingletonReplacement');

    class ReplacementComponent extends DisposableComponent {
      public static readonly COMPONENT_KEY = KEY;
    }

    const plugin = new TestPlugin(app, manifest);
    const component = new ReplacementComponent();
    plugin.addChild(component);

    const replacement = new ReplacementComponent();
    plugin.addChild(replacement);

    expect(plugin['singletonComponents'].get(KEY)).toBe(replacement);
    expect(plugin._children).not.toContain(component);
    expect(plugin._children).toContain(replacement);
  });

  it('should bypass singleton logic when addChild is called after load', async () => {
    const KEY = Symbol('TestPostLoad');

    class PostLoadComponent extends DisposableComponent {
      public static readonly COMPONENT_KEY = KEY;
    }

    const plugin = new TestPlugin(app, manifest);
    await plugin.load();

    const component = new PostLoadComponent();
    plugin.addChild(component);

    expect(plugin['singletonComponents'].has(KEY)).toBe(false);
  });

  it('should call onExternalSettingsChange on settings component', async () => {
    const plugin = new TestPlugin(app, manifest);

    await plugin.onExternalSettingsChange();

    // Should not throw even without a settings component registered
  });

  it('should throw when getRegisteredComponent finds incompatible component', () => {
    const KEY = Symbol('Shared');

    class ComponentA extends DisposableComponent {
      public static readonly COMPONENT_KEY = KEY;
    }

    class ComponentB extends DisposableComponent {
      public static readonly COMPONENT_KEY = KEY;
    }

    const plugin = new TestPlugin(app, manifest);
    plugin.addChild(new ComponentA());

    // Manually call getRegisteredComponent with ComponentB which expects a different instance type
    expect(() => plugin['getRegisteredComponent'](ComponentB)).toThrow('Incompatible');
  });
});

describe('reloadPlugin', () => {
  function createMockPlugin(): Plugin {
    return strictProxy<Plugin>({
      app: {
        plugins: {
          disablePlugin: vi.fn(() => Promise.resolve()),
          enablePlugin: vi.fn(() => Promise.resolve())
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
          disablePlugin: vi.fn(() => Promise.resolve())
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
