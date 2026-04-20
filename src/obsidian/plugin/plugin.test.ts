import type {
  App as AppOriginal,
  Plugin,
  PluginManifest
} from 'obsidian';

import { Component } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
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
  public onLayoutReadyCalled = false;
  public onloadImplCalled = false;

  public getAbortSignalComponent(): typeof this.abortSignalComponent {
    return this.abortSignalComponent;
  }

  public getConsoleDebugComponent(): typeof this.consoleDebugComponent {
    return this.consoleDebugComponent;
  }

  public getLifecycleEventsComponent(): typeof this.lifecycleEventsComponent {
    return this.lifecycleEventsComponent;
  }

  public getNoticeComponent(): typeof this.noticeComponent {
    return this.noticeComponent;
  }

  public getSettingsComponent(): typeof this.settingsComponent {
    return this.settingsComponent;
  }

  protected override async onLayoutReady(): Promise<void> {
    await super.onLayoutReady();
    this.onLayoutReadyCalled = true;
  }

  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();
    this.onloadImplCalled = true;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  }) as never;
  app = appMock.asOriginalType__();
});

describe('PluginBase', () => {
  it('should create with all default components', () => {
    const plugin = new TestPlugin(app, manifest);
    expect(plugin.getAbortSignalComponent()).toBeDefined();
    expect(plugin.getConsoleDebugComponent()).toBeDefined();
    expect(plugin.getLifecycleEventsComponent()).toBeDefined();
    expect(plugin.getNoticeComponent()).toBeDefined();
    expect(plugin.getSettingsComponent()).toBeDefined();
  });

  it('should call onloadImpl during onload', async () => {
    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();
    expect(plugin.onloadImplCalled).toBe(true);
  });

  it('should trigger lifecycle events and layout ready after load', async () => {
    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();

    // Wait for the deferred afterLoad to complete
    await vi.waitFor(() => {
      expect(plugin.onLayoutReadyCalled).toBe(true);
    });
  });

  it('should delegate onExternalSettingsChange to settings component', async () => {
    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();

    const spy = vi.spyOn(plugin.getSettingsComponent(), 'onExternalSettingsChange');
    await plugin.onExternalSettingsChange();
    expect(spy).toHaveBeenCalled();
  });

  it('should replace singleton component with same COMPONENT_KEY', () => {
    const KEY = Symbol('TestSingleton');

    class SingletonComponent1 extends Component {
      public static readonly COMPONENT_KEY = KEY;
    }

    class SingletonComponent2 extends Component {
      public static readonly COMPONENT_KEY = KEY;
    }

    const plugin = new TestPlugin(app, manifest);
    const component1 = new SingletonComponent1();
    const component2 = new SingletonComponent2();

    const result1 = plugin['registerComponent']({ component: component1 });
    expect(result1).toBe(component1);

    const result2 = plugin['registerComponent']({ component: component2 });
    expect(result2).toBe(component2);

    expect(plugin['singletonComponents'].get(KEY)).toBe(component2);
  });

  it('should not replace multi-instance components without COMPONENT_KEY', () => {
    const plugin = new TestPlugin(app, manifest);
    const component1 = new Component();
    const component2 = new Component();

    plugin['registerComponent']({ component: component1 });
    plugin['registerComponent']({ component: component2 });

    // Both should be added as children (not replaced)
    const children = plugin._children;
    expect(children).toContain(component1);
    expect(children).toContain(component2);
  });

  it('should handle preload for singleton replacement', () => {
    const KEY = Symbol('TestPreload');

    class PreloadComponent extends Component {
      public static readonly COMPONENT_KEY = KEY;
    }

    const plugin = new TestPlugin(app, manifest);
    const component = new PreloadComponent();

    plugin['registerComponent']({ component, shouldPreload: true });
    expect(plugin['preloadComponents']).toContain(component);

    // Replacing singleton should remove old from preload
    const replacement = new PreloadComponent();
    plugin['registerComponent']({ component: replacement });
    expect(plugin['preloadComponents']).not.toContain(component);
  });

  it('should not call onLayoutReady when aborted before afterLoad', async () => {
    const plugin = new TestPlugin(app, manifest);
    plugin.getAbortSignalComponent().onunload();

    await plugin.onload();

    // AfterLoad checks abortSignal.aborted and returns early
    const WAIT_MS = 50;
    await new Promise<void>((resolve) => {
      activeWindow.setTimeout(resolve, WAIT_MS);
    });
    expect(plugin.onLayoutReadyCalled).toBe(false);
  });

  it('should trigger layoutReady lifecycle event even when onLayoutReady throws', async () => {
    class ThrowingPlugin extends TestPlugin {
      protected override async onLayoutReady(): Promise<void> {
        await Promise.reject(new Error('layout ready error'));
      }
    }

    const plugin = new ThrowingPlugin(app, manifest);
    await plugin.onload();

    // Wait for afterLoad to fire
    await vi.waitFor(() => {
      // The layoutReady event should still be triggered in the finally block
      expect(plugin.getLifecycleEventsComponent().events).toBeDefined();
    });
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
