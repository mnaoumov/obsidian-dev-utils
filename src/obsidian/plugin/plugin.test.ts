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

import type {
  PluginConflict,
  PluginDependency
} from '../components/plugin-gate-component.ts';
import type { TranslationsMap } from '../i18n/i18n.ts';
import type { PluginApiDeclaration } from './plugin-api.ts';
import type { PluginLifecycleEventPayload } from './plugin-lifecycle-events.ts';

import { noopAsync } from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { FileCommandHandler } from '../command-handlers/file-command-handler.ts';
import { ComponentEx } from '../components/component-ex.ts';
import { PluginConflictSeverity } from '../components/plugin-gate-component.ts';
import { PluginNoticeComponent } from '../components/plugin-notice-component.ts';
import { PluginSettingsComponentBase } from '../components/plugin-settings-component.ts';
import { PluginDataHandler } from '../data-handler.ts';
import { initI18N } from '../i18n/i18n.ts';
import { PluginEventSourceImpl } from './plugin-event-source.ts';
import {
  PLUGIN_LOADED_EVENT_NAME,
  PLUGIN_UNLOADED_EVENT_NAME
} from './plugin-lifecycle-events.ts';
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
  t: vi.fn(($function: (t: unknown) => string) =>
    $function({
      obsidianDevUtils: {
        notices: { unhandledError: 'error' },
        pluginConflict: {
          blockedNotice: 'conflict blocked',
          conflictAppearedNotice: 'conflict appeared',
          disable: 'disable',
          settingsHeading: 'conflicting plugin',
          warningNotice: 'conflict warning'
        },
        pluginDependency: {
          blockedNotice: 'blocked',
          dependencyLostNotice: 'lost',
          openDependencySettings: 'open dependency settings',
          settingsHeading: 'required plugin missing',
          versionMismatchNotice: 'version mismatch'
        }
      }
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

vi.mock('../../generated-during-build.ts', () => ({
  LIBRARY_STYLES: '',
  LIBRARY_VERSION: '1.0.0'
}));

vi.mock('../../obsidian-dev-utils-state.ts', () => ({
  getObsidianDevUtilsState: vi.fn((_key: string, defaultValue: unknown) => ({ value: defaultValue }))
}));

vi.mock('../css-class.ts', () => ({
  CssClass: {
    LibraryName: 'obsidian-dev-utils',
    PluginSettingsTab: 'plugin-settings-tab',
    Tooltip: 'tooltip',
    TooltipArrow: 'tooltip-arrow',
    TooltipValidator: 'tooltip-validator'
  }
}));

// Only `compareVersions` is stubbed. `satisfies` is the real thing, because the conflict gate's whole
// Job is deciding whether an installed version falls in a declared range — a stubbed answer would test
// Nothing.
vi.mock('compare-versions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('compare-versions')>();
  return {
    ...actual,
    compareVersions: vi.fn(() => 1)
  };
});

// The registry is reached through `getObsidianDevUtilsState`, which this file mocks to hand back a fresh
// Bag per call — so a real publish and a real watch would never meet. Mocking the publish instead keeps
// The assertions about WHAT gets published and WHEN, which is what this file is responsible for; the
// Registry's own behavior is covered by `plugin-api.test.ts`.
const {
  mockPublishPluginApi,
  mockWatchPluginApi
} = vi.hoisted(() => ({
  mockPublishPluginApi: vi.fn(),
  mockWatchPluginApi: vi.fn()
}));

vi.mock('./plugin-api.ts', () => ({
  publishPluginApi: mockPublishPluginApi,
  watchPluginApi: mockWatchPluginApi
}));

vi.mock('../../async.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../async.ts')>();
  return {
    ...actual,
    invokeAsyncSafelyAfterDelay: vi.fn((
      asyncFunction: (abortSignal: AbortSignal) => Promise<void>,
      _delayInMilliseconds?: number,
      _stackTrace?: string,
      abortSignal?: AbortSignal
    ) => {
      if (abortSignal?.aborted) {
        return;
      }
      asyncFunction(abortSignal ?? new AbortController().signal).catch(() => {
        /*
        Swallow errors in test mock.
        */
      });
    })
  };
});

interface AppSettingHolder {
  setting: unknown;
}

interface PublishedPluginApiParams {
  readonly apiVersion: string;
  readonly component: unknown;
}

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

  public getAsyncErrorHandlerComponent(): typeof this.asyncErrorHandlerComponent {
    return this.asyncErrorHandlerComponent;
  }

  public getCommandHandlerComponent(): typeof this.commandHandlerComponent {
    return this.commandHandlerComponent;
  }

  public getConsoleDebugComponent(): typeof this.consoleDebugComponent {
    return this.consoleDebugComponent;
  }

  public getNoticeComponent(): typeof this.pluginNoticeComponent {
    return this.pluginNoticeComponent;
  }

  public getPluginContextComponent(): typeof this.pluginContextComponent {
    return this.pluginContextComponent;
  }

  public getPluginGateComponent(): typeof this.pluginGateComponent {
    return this.pluginGateComponent;
  }

  public getPluginSettingsComponent(): typeof this.pluginSettingsComponent {
    return this.pluginSettingsComponent;
  }

  public getResourceLockComponent(): typeof this.resourceLockComponent {
    return this.resourceLockComponent;
  }

  public setNoticeComponent(value: PluginNoticeComponent): void {
    this.pluginNoticeComponent = value;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((callback: () => void) => {
    callback();
  });
  // The gate registers a stand-in settings tab while a dependency is missing or a conflict holds, which
  // Is the one part of `app.setting` any of these tests reaches.
  castTo<AppSettingHolder>(appMock).setting = {
    addSettingTab: vi.fn(),
    removeSettingTab: vi.fn()
  };
  app = appMock.asOriginalType__();
});

describe('PluginBase', () => {
  it('should create with all default components', async () => {
    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();
    expect(plugin.getAbortSignalComponent()).toBeDefined();
    expect(plugin.getAsyncErrorHandlerComponent()).toBeDefined();
    expect(plugin.getConsoleDebugComponent()).toBeDefined();
    expect(plugin.getResourceLockComponent()).toBeDefined();
    expect(plugin.getNoticeComponent()).toBeDefined();
    expect(plugin.getPluginContextComponent()).toBeDefined();
    expect(plugin.getPluginGateComponent()).toBeDefined();
    expect(plugin.getPluginSettingsComponent()).toBeDefined();
  });

  it('should unload the component a setter replaces', async () => {
    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();

    const replacedComponent = plugin.getNoticeComponent();
    expect(replacedComponent._loaded).toBe(true);

    const replacementComponent = plugin.addChild(
      new PluginNoticeComponent({
        app,
        pluginName: manifest.name
      })
    );
    plugin.setNoticeComponent(replacementComponent);

    expect(plugin.getNoticeComponent()).toBe(replacementComponent);
    expect(replacedComponent._loaded).toBe(false);
    expect(replacementComponent._loaded).toBe(true);
  });

  it('should create the command handler component and register the unlock active note command on load', async () => {
    const plugin = new TestPlugin(app, manifest);
    const addCommandSpy = vi.spyOn(plugin, 'addCommand');
    await plugin.onload();
    expect(plugin.getCommandHandlerComponent()).toBeDefined();
    expect(addCommandSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'unlock-active-note' }));
  });

  it('should initialize i18n with the default translations map on load', async () => {
    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();
    expect(vi.mocked(initI18N)).toHaveBeenCalledWith({});
  });

  it('should initialize i18n with a subclass-provided translations map', async () => {
    const customMap: TranslationsMap = { fr: { hello: 'bonjour' } };

    class CustomTranslationsPlugin extends PluginBase {
      protected override createTranslationsMap(): TranslationsMap {
        return customMap;
      }
    }

    const plugin = new CustomTranslationsPlugin(app, manifest);
    await plugin.onload();
    expect(vi.mocked(initI18N)).toHaveBeenCalledWith(customMap);
  });

  it('should let onloadImpl register a file command handler, whose menu events the registrar accepts', async () => {
    class FileMenuCommandHandler extends FileCommandHandler {
      protected override canExecuteFile(): boolean {
        return true;
      }

      protected override async executeFile(): Promise<void> {
        await noopAsync();
      }
    }

    class FileMenuPlugin extends TestPlugin {
      protected override async onloadImpl(): Promise<void> {
        await this.commandHandlerComponent.registerCommandHandlers(() => [
          new FileMenuCommandHandler({
            icon: 'file-icon',
            id: 'file-command',
            name: 'File Command'
          })
        ]);
      }
    }

    const onSpy = vi.spyOn(app.workspace, 'on');
    const plugin = new FileMenuPlugin(app, manifest);

    // `registerCommandHandlers` awaits `onRegistered`, so a handler registers its menu events during
    // `onloadImpl` rather than after it.
    // The registrar is already loaded by then, because `onload` loads the wrapper up front.
    // Were it not, this would reject with 'Component is not loaded' rather than register anything.
    await expect(plugin.onload()).resolves.toBeUndefined();
    expect(onSpy).toHaveBeenCalledWith('file-menu', expect.any(Function));
  });

  it('should load children sequentially (children-first) via onloadImpl', async () => {
    const order: string[] = [];
    let wasFirstLoadedWhenSecondRan = false;

    class OrderedChildComponent extends ComponentEx {
      public constructor(private readonly label: string, private readonly onLoaded?: () => void) {
        super();
      }

      public override async onloadAsync(): Promise<void> {
        await noopAsync();
        order.push(this.label);
        this.onLoaded?.();
      }
    }

    class OrderedPlugin extends TestPlugin {
      protected override onloadImpl(): void {
        const first = this.addChild(new OrderedChildComponent('first'));
        this.addChild(
          new OrderedChildComponent('second', () => {
            wasFirstLoadedWhenSecondRan = first._loaded;
          })
        );
      }
    }

    const plugin = new OrderedPlugin(app, manifest);
    await plugin.onload();

    expect(order).toEqual(['first', 'second']);
    expect(wasFirstLoadedWhenSecondRan).toBe(true);
  });

  it('should reject when an onloadImpl child fails to load', async () => {
    class FailingChildComponent extends ComponentEx {
      public override onloadAsync(): Promise<void> {
        return Promise.reject(new Error('child load failed'));
      }
    }

    class FailingPlugin extends TestPlugin {
      protected override onloadImpl(): void {
        this.addChild(new FailingChildComponent());
      }
    }

    const plugin = new FailingPlugin(app, manifest);
    await expect(plugin.onload()).rejects.toThrow(AggregateError);
  });

  it('should delegate removeChild to wrapperComponent', () => {
    const plugin = new TestPlugin(app, manifest);
    plugin.load();

    const child = plugin.addChild(new Component());
    const removed = plugin.removeChild(child);
    expect(removed).toBe(child);
  });

  it('should call onExternalSettingsChange on settings component', async () => {
    const plugin = new TestPlugin(app, manifest);
    plugin.load();

    await plugin.onExternalSettingsChange();

    // Should not throw even without a settings component registered
  });

  it('should keep the saved settings when onloadImpl replaces the placeholder settings component', async () => {
    // The placeholder `PluginSettingsComponentBase<object>` added during `onload` knows no property
    // Names, so it used to load every real setting, keep none of them, and save the difference back --
    // Leaving `data.json` as `{}`. Reported as Embed HTML #15 and CodeScript Toolkit #59; whether the
    // Wipe survived depended on which of the two components' saves landed last, which is why it read as
    // Intermittent.
    const savedSettings = {
      defaultHeight: 'fit-content',
      shouldShowOpenInExternalBrowserButton: false
    };

    class RealPluginSettings {
      public defaultHeight = '';
      public shouldShowOpenInExternalBrowserButton = true;
    }

    // Subclassed rather than instantiated generically, because that is how a real plugin supplies its
    // Settings component -- and `PluginSettingsComponentBase<RealPluginSettings>` is not assignable to
    // The `<object>` the setter takes under `exactOptionalPropertyTypes`.
    class RealPluginSettingsComponent extends PluginSettingsComponentBase<RealPluginSettings> {}

    class SettingsPlugin extends TestPlugin {
      public data: unknown = { ...savedSettings };

      public getSettings(): RealPluginSettings {
        return this.pluginSettingsComponent.settings as RealPluginSettings;
      }

      public override loadData(): Promise<unknown> {
        return Promise.resolve(this.data);
      }

      public override saveData(data: unknown): Promise<void> {
        this.data = data;
        return noopAsync();
      }

      protected override onloadImpl(): void {
        // `castTo` for the same reason a real plugin narrows this accessor pair: a component typed on the
        // Plugin's own settings class is not assignable to the base's `<object>` under
        // `exactOptionalPropertyTypes`.
        this.pluginSettingsComponent = castTo<PluginSettingsComponentBase<object>>(
          this.addChild(
            new RealPluginSettingsComponent({
              dataHandler: new PluginDataHandler(this),
              pluginEventSource: new PluginEventSourceImpl(this),
              pluginSettingsClass: RealPluginSettings
            })
          )
        );
      }
    }

    const plugin = new SettingsPlugin(app, manifest);
    await plugin.onload();

    expect(plugin.data).toStrictEqual(savedSettings);
    expect(plugin.getSettings().defaultHeight).toBe('fit-content');
    expect(plugin.getSettings().shouldShowOpenInExternalBrowserButton).toBe(false);
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
      manifest: {
        id: 'test-plugin',
        name: 'Test Plugin'
      }
    });
  }

  it('should show error and disable plugin', async () => {
    const showNoticeSpy = vi.spyOn(PluginNoticeComponent.prototype, 'showNotice');
    const plugin = createMockPlugin();
    await showErrorAndDisablePlugin(plugin, 'Test error');
    expect(showNoticeSpy).toHaveBeenCalledWith('Test error');
    expect(plugin.app.plugins.disablePlugin).toHaveBeenCalledWith('test-plugin');
    showNoticeSpy.mockRestore();
  });
});

describe('lifecycle broadcast', () => {
  class PublishingPlugin extends TestPlugin {
    protected override getPluginApis(): PluginApiDeclaration[] {
      return [{
        api: { ping: (): string => 'pong' },
        apiVersion: '1.2.3'
      }];
    }
  }

  it('should announce a completed load, describing the plugin', async () => {
    const callback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_LOADED_EVENT_NAME, callback);

    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();

    expect(callback).toHaveBeenCalledWith({
      apiVersions: [],
      dependencyPluginIds: [],
      pluginId: manifest.id,
      pluginName: manifest.name,
      pluginVersion: manifest.version
    });
  });

  it('should list the published contract versions, so a listener knows what is on offer', async () => {
    const callback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_LOADED_EVENT_NAME, callback);

    const plugin = new PublishingPlugin(app, manifest);
    await plugin.onload();

    expect(callback.mock.calls[0]?.[0].apiVersions).toEqual(['1.2.3']);
  });

  it('should publish declared APIs BEFORE announcing, so a listener may call them straight away', async () => {
    const order: string[] = [];
    mockPublishPluginApi.mockImplementation(() => {
      order.push('publish');
    });
    app.workspace.on(PLUGIN_LOADED_EVENT_NAME, () => {
      order.push('announce');
    });

    await new PublishingPlugin(app, manifest).onload();

    expect(order).toEqual(['publish', 'announce']);
  });

  it('should revoke a published API with the feature surface rather than with the plugin', async () => {
    const plugin = new PublishingPlugin(app, manifest);
    await plugin.onload();

    const publishedParams: unknown = mockPublishPluginApi.mock.calls[0]?.[0];
    expect(castTo<PublishedPluginApiParams>(publishedParams).apiVersion).toBe('1.2.3');

    // The owner is the gated surface, not the plugin: a plugin whose dependency goes away keeps running
    // Its universal components, and a consumer must not keep a handle into the half that was torn down.
    expect(castTo<PublishedPluginApiParams>(publishedParams).component).not.toBe(plugin);
    expect(castTo<PublishedPluginApiParams>(publishedParams).component).toBeInstanceOf(ComponentEx);
  });

  it('should announce the departure when the plugin unloads', async () => {
    const callback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_UNLOADED_EVENT_NAME, callback);

    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();
    plugin.onunload();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ pluginId: manifest.id }));
  });

  it('should announce a departure only once, so a second unload is silent', async () => {
    const callback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_UNLOADED_EVENT_NAME, callback);

    const plugin = new TestPlugin(app, manifest);
    await plugin.onload();
    plugin.onunload();
    plugin.onunload();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not announce a departure for a plugin that never announced a load', () => {
    const callback = vi.fn<(payload: PluginLifecycleEventPayload) => void>();
    app.workspace.on(PLUGIN_UNLOADED_EVENT_NAME, callback);

    new TestPlugin(app, manifest).onunload();

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('the conflict gate', () => {
  const CONFLICTING_PLUGIN_ID = 'conflicting-plugin';

  class ConflictedPlugin extends TestPlugin {
    public readonly featureComponent = new ComponentEx();

    protected override getPluginConflicts(): PluginConflict[] {
      return [{
        conflictingVersionRange: '<2.0.0',
        pluginId: CONFLICTING_PLUGIN_ID,
        pluginName: 'Conflicting Plugin',
        reason: 'Both would act on the same rename.',
        severity: PluginConflictSeverity.Block
      }];
    }

    protected override onloadImpl(): void {
      this.addChild(this.featureComponent);
    }
  }

  it('should not run onloadImpl while a conflicting plugin is enabled at a conflicting version', async () => {
    installConflictingPlugin('1.9.0');
    const plugin = new ConflictedPlugin(app, manifest);

    await plugin.onload();

    expect(plugin.featureComponent._loaded).toBe(false);
  });

  it('should load normally once the conflicting plugin is past the conflicting range', async () => {
    installConflictingPlugin('2.0.0');
    const plugin = new ConflictedPlugin(app, manifest);

    await plugin.onload();

    expect(plugin.featureComponent._loaded).toBe(true);
  });

  it('should load normally when the conflicting plugin is not installed at all', async () => {
    const plugin = new ConflictedPlugin(app, manifest);

    await plugin.onload();

    expect(plugin.featureComponent._loaded).toBe(true);
  });

  // The mock refuses to read `manifests` until it has been assigned, so the whole record is supplied
  // Rather than mutated in place.
  function installConflictingPlugin(version: string): void {
    app.plugins.enabledPlugins.add(CONFLICTING_PLUGIN_ID);
    const manifests: AppOriginal['plugins']['manifests'] = {};
    Object.setPrototypeOf(manifests, null);
    manifests[CONFLICTING_PLUGIN_ID] = castTo<PluginManifest>({
      id: CONFLICTING_PLUGIN_ID,
      version
    });
    app.plugins.manifests = manifests;
  }
});

describe('the dependency gate', () => {
  class DependentPlugin extends TestPlugin {
    public readonly featureComponent = new ComponentEx();

    protected override getPluginDependencies(): PluginDependency[] {
      return [{
        apiVersionRange: '^1',
        pluginId: 'required-plugin',
        pluginName: 'Required Plugin',
        reason: 'Does the thing.'
      }];
    }

    protected override onloadImpl(): void {
      this.addChild(this.featureComponent);
    }
  }

  let apiRefValue: null | object;
  let fireApiRefChange: () => Promise<void>;

  beforeEach(() => {
    apiRefValue = {};
    fireApiRefChange = noopAsync;

    mockWatchPluginApi.mockImplementation(() => {
      const changeCallbacks: (() => Promise<void>)[] = [];
      fireApiRefChange = async (): Promise<void> => {
        for (const callback of changeCallbacks) {
          await callback();
        }
      };

      return castTo<unknown>({
        on: (_name: string, callback: () => Promise<void>) => {
          changeCallbacks.push(callback);
          return { asyncEventSource: { offref: vi.fn() } };
        },
        get value(): null | object {
          return apiRefValue;
        }
      });
    });
  });

  it('should not run onloadImpl while the dependency is missing, so the plugin registers nothing', async () => {
    apiRefValue = null;
    const plugin = new DependentPlugin(app, manifest);

    await plugin.onload();

    expect(plugin.featureComponent._loaded).toBe(false);
  });

  it('should not announce a load it never completed', async () => {
    apiRefValue = null;
    const callback = vi.fn();
    app.workspace.on(PLUGIN_LOADED_EVENT_NAME, callback);

    await new DependentPlugin(app, manifest).onload();

    expect(callback).not.toHaveBeenCalled();
  });

  it('should complete the load when the dependency arrives, with no restart', async () => {
    apiRefValue = null;
    const plugin = new DependentPlugin(app, manifest);
    await plugin.onload();

    apiRefValue = {};
    await fireApiRefChange();

    expect(plugin.featureComponent._loaded).toBe(true);
  });

  it('should tear the feature surface down when the dependency goes away, keeping the universal components', async () => {
    const plugin = new DependentPlugin(app, manifest);
    await plugin.onload();
    expect(plugin.featureComponent._loaded).toBe(true);

    apiRefValue = null;
    await fireApiRefChange();

    expect(plugin.featureComponent._loaded).toBe(false);

    // The notice component is what has to say the dependency went away, so it must have survived.
    expect(plugin.getNoticeComponent()._loaded).toBe(true);
  });

  it('should announce the departure when the dependency goes away', async () => {
    const callback = vi.fn();
    app.workspace.on(PLUGIN_UNLOADED_EVENT_NAME, callback);
    const plugin = new DependentPlugin(app, manifest);
    await plugin.onload();

    apiRefValue = null;
    await fireApiRefChange();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ dependencyPluginIds: ['required-plugin'] }));
  });

  it('should rebuild the feature surface on a fresh wrapper when the dependency comes back', async () => {
    const plugin = new DependentPlugin(app, manifest);
    await plugin.onload();

    apiRefValue = null;
    await fireApiRefChange();
    apiRefValue = {};
    await fireApiRefChange();

    // A once-unloaded `ComponentEx` refuses new children, so a surface that came back on the SAME wrapper
    // Could not have re-run `onloadImpl` at all. Its child being loaded again proves the wrapper is new.
    expect(plugin.featureComponent._loaded).toBe(true);
  });
});
