// @vitest-environment jsdom

/**
 * @file
 *
 * Tests for {@link PluginGateComponent}.
 */

import type {
  App as AppOriginal,
  ButtonComponent as ButtonComponentOriginal,
  EventRef,
  Plugin,
  PluginManifest,
  SettingTab
} from 'obsidian';
import type { ButtonComponent } from 'obsidian-test-mocks/obsidian';

import { ButtonComponent as ButtonComponentClass } from 'obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginApiRef } from '../plugin/plugin-api.ts';
import type { PluginLifecycleEventPayload } from '../plugin/plugin-lifecycle-events.ts';
import type {
  PluginConflict,
  PluginDependency
} from './plugin-gate-component.ts';
import type { PluginNoticeComponent } from './plugin-notice-component.ts';

import { noopAsync } from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { mockImplementation } from '../../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../../type-guards.ts';
import {
  PLUGIN_LOADED_EVENT_NAME,
  PLUGIN_UNLOADED_EVENT_NAME
} from '../plugin/plugin-lifecycle-events.ts';
import {
  PluginConflictSeverity,
  PluginGateComponent
} from './plugin-gate-component.ts';

interface ComponentContext {
  readonly component: PluginGateComponent;
  readonly loadFeatureSurface: ReturnType<typeof vi.fn>;
  readonly showNotice: ReturnType<typeof vi.fn>;
  readonly unloadFeatureSurface: ReturnType<typeof vi.fn>;
}

interface CreateComponentOptions {
  readonly conflicts?: readonly PluginConflict[];
  readonly dependencies?: readonly PluginDependency[];
  readonly isSatisfied?: boolean;
}

interface DisplayableSettingTab {
  containerEl: HTMLElement;
  display(): void;
}

interface InstallCommunityPluginParams {
  readonly pluginId: string;
}

const DEPENDENCY: PluginDependency = {
  apiVersionRange: '^1',
  pluginId: 'required-plugin',
  pluginName: 'Required Plugin',
  reason: 'Handles renames and deletes for you.'
};

const BLOCKING_CONFLICT: PluginConflict = {
  conflictingVersionRange: '<12.0.0',
  pluginId: 'conflicting-plugin',
  pluginName: 'Conflicting Plugin',
  reason: 'Both would handle the same rename, and two handlers corrupt links.',
  severity: PluginConflictSeverity.Block
};

const HOST_PLUGIN_ID = 'host-plugin';

const HOST_PLUGIN_NAME = 'Host Plugin';

const WARNING_CONFLICT: PluginConflict = {
  conflictingVersionRange: '>=0.0.0',
  pluginId: 'overlapping-plugin',
  pluginName: 'Overlapping Plugin',
  reason: 'Both add a Collect attachments command, so you will see each one twice.',
  severity: PluginConflictSeverity.Warn
};

const {
  mockDisableCommunityPlugin,
  mockEnableCommunityPlugin,
  mockInstallConfigureEnableCommunityPlugin,
  mockWatchPluginApi
} = vi.hoisted(() => ({
  mockDisableCommunityPlugin: vi.fn(),
  mockEnableCommunityPlugin: vi.fn(),
  mockInstallConfigureEnableCommunityPlugin: vi.fn(),
  mockWatchPluginApi: vi.fn()
}));

vi.mock('../plugin/plugin-api.ts', () => ({ watchPluginApi: mockWatchPluginApi }));

vi.mock('../community-plugins.ts', () => ({
  disableCommunityPlugin: mockDisableCommunityPlugin,
  enableCommunityPlugin: mockEnableCommunityPlugin,
  installConfigureEnableCommunityPlugin: mockInstallConfigureEnableCommunityPlugin
}));

let addSettingTab: ReturnType<typeof vi.fn>;
let apiRefValue: null | object;
let enabledPlugins: Set<string>;
let fireApiRefChange: () => Promise<void>;
let lifecycleCallbacks: Map<string, ((payload: PluginLifecycleEventPayload) => unknown)[]>;
let layoutReadyCallback: (() => void) | undefined;
let manifests: AppOriginal['plugins']['manifests'];
let openSetting: ReturnType<typeof vi.fn>;
let openTabById: ReturnType<typeof vi.fn>;
let removeSettingTab: ReturnType<typeof vi.fn>;
let buttonInstances: ButtonComponentOriginal[];
let settingTabs: SettingTab[];

beforeEach(() => {
  // `LayoutReadyComponent` defers its callback through a `setTimeout(…, 0)`, so the layout-ready path is
  // Only observable once the timers are drained.
  vi.useFakeTimers();
  apiRefValue = {};
  enabledPlugins = new Set<string>();
  layoutReadyCallback = undefined;
  lifecycleCallbacks = new Map();
  manifests = {};
  Object.setPrototypeOf(manifests, null);
  settingTabs = [];
  fireApiRefChange = async (): Promise<void> => {
    // Replaced when the component subscribes; a test that fires before that is asserting nothing.
  };

  mockDisableCommunityPlugin.mockResolvedValue(undefined);
  mockEnableCommunityPlugin.mockResolvedValue(undefined);
  mockInstallConfigureEnableCommunityPlugin.mockResolvedValue(undefined);
  buttonInstances = [];
  mockImplementation({
    $object: ButtonComponentClass.prototype,
    impl: function impl(this: ButtonComponentOriginal, originalImplementation, containerEl: HTMLElement): ButtonComponentOriginal {
      originalImplementation.call(this, containerEl);
      buttonInstances.push(this);
      return this;
    },
    method: 'constructor2__'
  });
  openSetting = vi.fn();
  openTabById = vi.fn();

  addSettingTab = vi.fn((tab: SettingTab) => {
    settingTabs.push(tab);
  });
  removeSettingTab = vi.fn((tab: SettingTab) => {
    settingTabs = settingTabs.filter((candidate) => candidate !== tab);
  });

  mockWatchPluginApi.mockImplementation(() => {
    const changeCallbacks: (() => Promise<void>)[] = [];
    fireApiRefChange = async (): Promise<void> => {
      for (const callback of changeCallbacks) {
        await callback();
      }
    };

    return castTo<PluginApiRef<object>>({
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

afterEach(() => {
  vi.useRealTimers();
});

describe('with no declared dependencies', () => {
  it('should load the feature surface immediately, so a plugin declaring none behaves exactly as before', async () => {
    const { loadFeatureSurface } = await createLoadedComponent({ dependencies: [] });

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
    expect(addSettingTab).not.toHaveBeenCalled();
  });
});

describe('with a satisfied dependency', () => {
  it('should load the feature surface and say nothing', async () => {
    const { loadFeatureSurface, showNotice } = await createLoadedComponent();

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
    expect(showNotice).not.toHaveBeenCalled();
    expect(addSettingTab).not.toHaveBeenCalled();
  });

  it('should not reload the feature surface when the provider re-publishes while still satisfied', async () => {
    const { loadFeatureSurface } = await createLoadedComponent();

    // A `change` fires whenever the ref's value is re-resolved, which includes a provider publishing a
    // Second contract version. Nothing about the plugin's surface has changed, so it must stay up.
    await fireApiRefChange();

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
  });
});

describe('with an unsatisfied dependency', () => {
  it('should not load the feature surface', async () => {
    const { loadFeatureSurface } = await createLoadedComponent({ isSatisfied: false });

    expect(loadFeatureSurface).not.toHaveBeenCalled();
  });

  it('should stay silent until the layout is ready, because a dependency may simply not have loaded yet', async () => {
    const { showNotice } = await createLoadedComponent({ isSatisfied: false });

    expect(showNotice).not.toHaveBeenCalled();
    expect(addSettingTab).not.toHaveBeenCalled();
  });

  it('should announce itself and show a settings tab once the layout is ready', async () => {
    const { showNotice } = await createLoadedComponent({ isSatisfied: false });

    await triggerLayoutReady();

    expectNoticeText(showNotice, `${HOST_PLUGIN_NAME} does nothing until ${DEPENDENCY.pluginName} is installed and enabled.`);
    expect(addSettingTab).toHaveBeenCalledTimes(1);
  });

  it('should announce only once while it stays unsatisfied', async () => {
    const { showNotice } = await createLoadedComponent({ isSatisfied: false });

    await triggerLayoutReady();
    await fireApiRefChange();

    expect(showNotice).toHaveBeenCalledTimes(1);
    expect(addSettingTab).toHaveBeenCalledTimes(1);
  });

  it('should load the feature surface and drop the settings tab when the dependency arrives', async () => {
    const { loadFeatureSurface } = await createLoadedComponent({ isSatisfied: false });
    await triggerLayoutReady();

    apiRefValue = {};
    await fireApiRefChange();

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
    expect(removeSettingTab).toHaveBeenCalledTimes(1);
    expect(settingTabs).toHaveLength(0);
  });
});

describe('when a satisfied dependency goes away', () => {
  it('should unload the feature surface and say so immediately', async () => {
    const { showNotice, unloadFeatureSurface } = await createLoadedComponent();

    apiRefValue = null;
    await fireApiRefChange();

    expect(unloadFeatureSurface).toHaveBeenCalledTimes(1);
    expectNoticeText(
      showNotice,
      `${DEPENDENCY.pluginName} is no longer available, so ${HOST_PLUGIN_NAME} has stopped working. Bring it back to resume.`
    );
    expect(addSettingTab).toHaveBeenCalledTimes(1);
  });

  it('should reload the feature surface when the dependency comes back', async () => {
    const { loadFeatureSurface } = await createLoadedComponent();

    apiRefValue = null;
    await fireApiRefChange();
    apiRefValue = {};
    await fireApiRefChange();

    expect(loadFeatureSurface).toHaveBeenCalledTimes(2);
    expect(settingTabs).toHaveLength(0);
  });

  it('should announce each loss, not only the first', async () => {
    const { showNotice } = await createLoadedComponent();

    apiRefValue = null;
    await fireApiRefChange();
    apiRefValue = {};
    await fireApiRefChange();
    apiRefValue = null;
    await fireApiRefChange();

    expect(showNotice).toHaveBeenCalledTimes(2);
  });
});

describe('unload', () => {
  it('should take its settings tab away with it', async () => {
    const { component } = await createLoadedComponent({ isSatisfied: false });
    await triggerLayoutReady();

    component.unload();

    expect(removeSettingTab).toHaveBeenCalledTimes(1);
    expect(settingTabs).toHaveLength(0);
  });

  it('should not remove a settings tab it never added', async () => {
    const { component } = await createLoadedComponent();

    component.unload();

    expect(removeSettingTab).not.toHaveBeenCalled();
  });
});

async function createLoadedComponent(options: CreateComponentOptions = {}): Promise<ComponentContext> {
  apiRefValue = (options.isSatisfied ?? true) ? {} : null;

  const app = strictProxy<AppOriginal>({
    plugins: strictProxy<AppOriginal['plugins']>({
      enabledPlugins,
      manifests
    }),
    // Cast rather than typed one member at a time: `openTabById` is overloaded (`'hotkeys'` returns a
    // Narrower tab), and a plain mock cannot satisfy an overload set.
    setting: strictProxy<AppOriginal['setting']>(castTo<Partial<AppOriginal['setting']>>({
      addSettingTab,
      open: openSetting,
      openTabById,
      removeSettingTab
    })),
    workspace: strictProxy<AppOriginal['workspace']>({
      // Cast for the same reason `setting` is: `Workspace.on` is a large overload set, and a plain mock
      // Cannot satisfy one.
      on: castTo<AppOriginal['workspace']['on']>(
        (name: string, callback: (payload: PluginLifecycleEventPayload) => unknown): EventRef => {
          const callbacks = lifecycleCallbacks.get(name) ?? [];
          callbacks.push(callback);
          lifecycleCallbacks.set(name, callbacks);
          return castTo<EventRef>({});
        }
      ),
      onLayoutReady: vi.fn((callback: () => void) => {
        layoutReadyCallback = callback;
      })
    })
  });

  const plugin = strictProxy<Plugin>({
    app,
    manifest: strictProxy<PluginManifest>({
      id: HOST_PLUGIN_ID,
      name: HOST_PLUGIN_NAME
    })
  });

  const loadFeatureSurface = vi.fn<() => Promise<void>>().mockResolvedValue();
  const showNotice = vi.fn();
  const unloadFeatureSurface = vi.fn();

  const component = new PluginGateComponent({
    conflicts: options.conflicts ?? [],
    dependencies: options.dependencies ?? [DEPENDENCY],
    loadFeatureSurface,
    plugin,
    pluginNoticeComponent: castTo<PluginNoticeComponent>({ showNotice }),
    unloadFeatureSurface
  });

  component.load();
  await component.loadWithPromises();

  return {
    component,
    loadFeatureSurface,
    showNotice,
    unloadFeatureSurface
  };
}

// The plugin names are rendered as inline code blocks, so a notice is a `DocumentFragment` and its text
// Content is what the user reads.
function expectNoticeText(showNotice: ReturnType<typeof vi.fn>, expectedText: string): void {
  const message: unknown = showNotice.mock.calls.at(-1)?.[0];
  expect(message).toBeInstanceOf(DocumentFragment);
  expect(castTo<DocumentFragment>(message).textContent).toBe(expectedText);
}

async function triggerLayoutReady(): Promise<void> {
  layoutReadyCallback?.();
  await vi.runAllTimersAsync();
}

describe('the blocked settings tab', () => {
  it('should explain what is missing, why it is needed, and offer to install it', async () => {
    await createLoadedComponent({ isSatisfied: false });
    await triggerLayoutReady();

    const containerEl = displayBlockedSettingTab();

    expect(containerEl.querySelector('h2')?.textContent).toBe('Required plugin missing');
    expect(containerEl.textContent).toContain(`${HOST_PLUGIN_NAME} does nothing until ${DEPENDENCY.pluginName}`);
    expect(containerEl.textContent).toContain(DEPENDENCY.reason);
    expect(buttonTexts(containerEl)).toEqual(['Install and enable']);
  });

  it('should offer only an enable when the dependency is installed but disabled, so nothing is downloaded', async () => {
    manifests[DEPENDENCY.pluginId] = strictProxy<PluginManifest>({ id: DEPENDENCY.pluginId });
    await createLoadedComponent({ isSatisfied: false });
    await triggerLayoutReady();

    expect(buttonTexts(displayBlockedSettingTab())).toEqual(['Enable']);
  });

  it('should link out to the dependency settings when it is enabled but still unsatisfied, e.g. too old', async () => {
    manifests[DEPENDENCY.pluginId] = strictProxy<PluginManifest>({ id: DEPENDENCY.pluginId });
    enabledPlugins.add(DEPENDENCY.pluginId);
    await createLoadedComponent({ isSatisfied: false });
    await triggerLayoutReady();

    const containerEl = displayBlockedSettingTab();

    expect(buttonTexts(containerEl)).toEqual(['Install and enable', `Open ${DEPENDENCY.pluginName} settings`]);

    clickButton(1);

    expect(openSetting).toHaveBeenCalledTimes(1);
    expect(openTabById).toHaveBeenCalledWith(DEPENDENCY.pluginId);
  });

  it('should install and enable the dependency when the button is clicked', async () => {
    await createLoadedComponent({ isSatisfied: false });
    await triggerLayoutReady();

    displayBlockedSettingTab();
    clickButton(0);
    await vi.runAllTimersAsync();

    const params: unknown = mockInstallConfigureEnableCommunityPlugin.mock.calls[0]?.[0];
    expect(castTo<InstallCommunityPluginParams>(params).pluginId).toBe(DEPENDENCY.pluginId);
  });
});

function buttonTexts(containerEl: HTMLElement): string[] {
  return [...containerEl.querySelectorAll('button')].map((button) => button.textContent);
}

// The mock button component keeps its handler off the DOM node, so a native click does nothing; the
// Instances are captured at construction and driven through the mock's own trigger.
function clickButton(index: number): void {
  const button = buttonInstances[index];
  assertNonNullable(button);
  castTo<ButtonComponent>(button).simulateClick__();
}

// Renders the tab the component registered, which is the only way its banner is reachable — a blocked
// Plugin never got to register a settings tab of its own.
function displayBlockedSettingTab(): HTMLElement {
  const settingTab = settingTabs[0];
  assertNonNullable(settingTab);
  const displayableSettingTab = castTo<DisplayableSettingTab>(settingTab);
  displayableSettingTab.containerEl = createDiv();
  displayableSettingTab.display();
  return displayableSettingTab.containerEl;
}

describe('with a blocking conflict', () => {
  it('should not load the feature surface while the conflicting plugin is enabled at a conflicting version', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    expect(loadFeatureSurface).not.toHaveBeenCalled();
  });

  it('should load the feature surface once the conflicting plugin is new enough', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '12.0.0');
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
  });

  it('should ignore a conflicting plugin that is installed but disabled, because it registers nothing', async () => {
    manifests[BLOCKING_CONFLICT.pluginId] = strictProxy<PluginManifest>({
      id: BLOCKING_CONFLICT.pluginId,
      version: '11.9.0'
    });
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
  });

  it('should fail closed on a version it cannot parse, because a false all-clear is the expensive mistake', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, 'not-a-version');
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    expect(loadFeatureSurface).not.toHaveBeenCalled();
  });

  it('should announce itself and show a settings tab once the layout is ready', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    const { showNotice } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    await triggerLayoutReady();

    expectNoticeText(
      showNotice,
      `${HOST_PLUGIN_NAME} does nothing while ${BLOCKING_CONFLICT.pluginName} is enabled. Update or disable it to continue.`
    );
    expect(addSettingTab).toHaveBeenCalledTimes(1);
  });

  it('should explain the conflict in its settings tab and offer to disable the other plugin', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });
    await triggerLayoutReady();

    const containerEl = displayBlockedSettingTab();

    expect(containerEl.querySelector('h2')?.textContent).toBe('Conflicting plugin');
    expect(containerEl.textContent).toContain(BLOCKING_CONFLICT.reason);
    expect(buttonTexts(containerEl)).toEqual([
      `Disable ${BLOCKING_CONFLICT.pluginName}`,
      `Open ${BLOCKING_CONFLICT.pluginName} settings`
    ]);
  });

  it('should disable the conflicting plugin and come back up when the button is clicked', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });
    await triggerLayoutReady();

    displayBlockedSettingTab();
    mockDisableCommunityPlugin.mockImplementation(() => {
      enabledPlugins.delete(BLOCKING_CONFLICT.pluginId);
      return noopAsync();
    });
    clickButton(0);
    await vi.runAllTimersAsync();

    expect(mockDisableCommunityPlugin).toHaveBeenCalledTimes(1);
    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
    expect(settingTabs).toHaveLength(0);
  });

  it('should link out to the conflicting plugin settings', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });
    await triggerLayoutReady();

    displayBlockedSettingTab();
    clickButton(1);

    expect(openSetting).toHaveBeenCalledTimes(1);
    expect(openTabById).toHaveBeenCalledWith(BLOCKING_CONFLICT.pluginId);
  });
});

describe('when a conflict appears while the plugin is running', () => {
  it('should tear the feature surface down and say so, on the library lifecycle broadcast', async () => {
    const { showNotice, unloadFeatureSurface } = await createLoadedComponent({
      conflicts: [BLOCKING_CONFLICT],
      dependencies: []
    });

    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    await fireLifecycleEvent(PLUGIN_LOADED_EVENT_NAME, BLOCKING_CONFLICT.pluginId);

    expect(unloadFeatureSurface).toHaveBeenCalledTimes(1);
    expectNoticeText(
      showNotice,
      `${BLOCKING_CONFLICT.pluginName} is now enabled, so ${HOST_PLUGIN_NAME} has stopped working. Update or disable it to resume.`
    );
  });

  it('should come back up when the conflicting plugin unloads', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    enabledPlugins.delete(BLOCKING_CONFLICT.pluginId);
    await fireLifecycleEvent(PLUGIN_UNLOADED_EVENT_NAME, BLOCKING_CONFLICT.pluginId);

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
  });

  it('should ignore the host plugin\'s own broadcast, which would otherwise re-enter the gate', async () => {
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    installPlugin(BLOCKING_CONFLICT.pluginId, '11.9.0');
    await fireLifecycleEvent(PLUGIN_LOADED_EVENT_NAME, HOST_PLUGIN_ID);

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
  });
});

describe('with a warning conflict', () => {
  it('should keep running, because the overlap is annoying rather than destructive', async () => {
    installPlugin(WARNING_CONFLICT.pluginId, '4.0.0');
    const { loadFeatureSurface } = await createLoadedComponent({ conflicts: [WARNING_CONFLICT], dependencies: [] });

    expect(loadFeatureSurface).toHaveBeenCalledTimes(1);
    expect(addSettingTab).not.toHaveBeenCalled();
  });

  it('should say so once the layout is ready, and only once', async () => {
    installPlugin(WARNING_CONFLICT.pluginId, '4.0.0');
    const { showNotice } = await createLoadedComponent({ conflicts: [WARNING_CONFLICT], dependencies: [] });

    expect(showNotice).not.toHaveBeenCalled();

    await triggerLayoutReady();
    await fireLifecycleEvent(PLUGIN_LOADED_EVENT_NAME, WARNING_CONFLICT.pluginId);

    expect(showNotice).toHaveBeenCalledTimes(1);
    expectNoticeText(showNotice, `${HOST_PLUGIN_NAME} and ${WARNING_CONFLICT.pluginName} overlap, and both are running.`);
  });

  it('should stay silent while the plugin is blocked, since a warning describes two RUNNING plugins', async () => {
    installPlugin(WARNING_CONFLICT.pluginId, '4.0.0');
    const { showNotice } = await createLoadedComponent({
      conflicts: [WARNING_CONFLICT],
      isSatisfied: false
    });

    await triggerLayoutReady();

    expect(showNotice).toHaveBeenCalledTimes(1);
    expectNoticeText(showNotice, `${HOST_PLUGIN_NAME} does nothing until ${DEPENDENCY.pluginName} is installed and enabled.`);
  });

  it('should announce a warning conflict that only appears later', async () => {
    const { showNotice } = await createLoadedComponent({ conflicts: [WARNING_CONFLICT], dependencies: [] });
    await triggerLayoutReady();

    expect(showNotice).not.toHaveBeenCalled();

    installPlugin(WARNING_CONFLICT.pluginId, '4.0.0');
    await fireLifecycleEvent(PLUGIN_LOADED_EVENT_NAME, WARNING_CONFLICT.pluginId);

    expect(showNotice).toHaveBeenCalledTimes(1);
  });
});

describe('hasActiveWarningConflicts', () => {
  it('should be false when the conflicting plugin is not installed', async () => {
    const { component } = await createLoadedComponent({ conflicts: [WARNING_CONFLICT], dependencies: [] });

    expect(component.hasActiveWarningConflicts()).toBe(false);
  });

  it('should be true when the conflicting plugin is installed at a conflicting version', async () => {
    installPlugin(WARNING_CONFLICT.pluginId, '4.0.0');
    const { component } = await createLoadedComponent({ conflicts: [WARNING_CONFLICT], dependencies: [] });

    expect(component.hasActiveWarningConflicts()).toBe(true);
  });

  // A settings tab asks this to decide whether to show the overlap row, and a BLOCKING conflict never
  // Reaches a settings tab the plugin builds — it never got to build one.
  it('should be false when only a blocking conflict holds', async () => {
    installPlugin(BLOCKING_CONFLICT.pluginId, '11.0.0');
    const { component } = await createLoadedComponent({ conflicts: [BLOCKING_CONFLICT], dependencies: [] });

    expect(component.hasActiveWarningConflicts()).toBe(false);
  });
});

describe('renderConflictWarningBanner', () => {
  it('should render nothing when no warning conflict holds', async () => {
    const { component } = await createLoadedComponent({ conflicts: [WARNING_CONFLICT], dependencies: [] });

    const containerEl = createDiv();
    component.renderConflictWarningBanner(containerEl);

    expect(containerEl.children).toHaveLength(0);
  });

  it('should explain the overlap and offer to disable the other plugin', async () => {
    installPlugin(WARNING_CONFLICT.pluginId, '4.0.0');
    const { component } = await createLoadedComponent({ conflicts: [WARNING_CONFLICT], dependencies: [] });

    const containerEl = createDiv();
    component.renderConflictWarningBanner(containerEl);

    expect(containerEl.textContent).toContain(`${HOST_PLUGIN_NAME} and ${WARNING_CONFLICT.pluginName} overlap`);
    expect(containerEl.textContent).toContain(WARNING_CONFLICT.reason);
    expect(buttonTexts(containerEl)).toEqual([
      `Disable ${WARNING_CONFLICT.pluginName}`,
      `Open ${WARNING_CONFLICT.pluginName} settings`
    ]);
  });
});

// The library's lifecycle broadcast is the only signal a conflict can react to, so a test drives it
// Directly rather than through a second plugin.
async function fireLifecycleEvent(name: string, pluginId: string): Promise<void> {
  const payload = castTo<PluginLifecycleEventPayload>({ pluginId });
  for (const callback of lifecycleCallbacks.get(name) ?? []) {
    callback(payload);
  }

  await vi.runAllTimersAsync();
}

function installPlugin(pluginId: string, version: string): void {
  manifests[pluginId] = strictProxy<PluginManifest>({
    id: pluginId,
    version
  });
  enabledPlugins.add(pluginId);
}
