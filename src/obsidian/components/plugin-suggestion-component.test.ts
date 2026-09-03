// @vitest-environment jsdom

/**
 * @file
 *
 * Tests for {@link PluginSuggestionComponent}.
 */

import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';
import type { ButtonComponent } from 'obsidian-test-mocks/obsidian';

import { ButtonComponent as ButtonComponentOriginal } from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginNoticeComponent } from './plugin-notice-component.ts';
import type { PluginSettingsComponentBase } from './plugin-settings-component.ts';

import {
  noop,
  noopAsync
} from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { mockImplementation } from '../../test-helpers/mock-implementation.ts';
import {
  PluginSuggestionComponent,
  SuggestedPluginState
} from './plugin-suggestion-component.ts';

interface ComponentContext {
  readonly app: AppOriginal;
  readonly component: PluginSuggestionComponent;
  /**
   * Completes the host's pending settings load, optionally with the declined flag the file turned out to
   * hold. Only meaningful when the component was created with `isSettingsLoadPending`.
   */
  finishSettingsLoad(isDeclined?: boolean): void;
  readonly setSuggestionDeclined: SetSuggestionDeclinedMock;
  readonly showNotice: ReturnType<typeof vi.fn>;
  triggerLayoutReady(): void;
}

interface CreateComponentOptions {
  readonly isDeclined?: boolean;
  readonly isEnabled?: boolean;
  readonly isInstalled?: boolean;
  /**
   * Leaves the host's settings load in flight, as it is whenever this component loads onto a layout that
   * is already ready.
   */
  readonly isSettingsLoadPending?: boolean;
}

type SetSuggestionDeclinedMock = ReturnType<typeof vi.fn<(isDeclined: boolean) => Promise<void>>>;

const SUGGESTED_PLUGIN_ID = 'suggested-plugin';
const SUGGESTED_PLUGIN_NAME = 'Suggested Plugin';
const REASON = 'Install the Suggested Plugin to keep links up to date.';

const {
  mockEnableCommunityPlugin,
  mockInstallConfigureEnableCommunityPlugin
} = vi.hoisted(() => ({
  mockEnableCommunityPlugin: vi.fn(),
  mockInstallConfigureEnableCommunityPlugin: vi.fn()
}));

vi.mock('../community-plugins.ts', () => ({
  enableCommunityPlugin: mockEnableCommunityPlugin,
  installConfigureEnableCommunityPlugin: mockInstallConfigureEnableCommunityPlugin
}));

const buttonInstances: ButtonComponentOriginal[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  mockEnableCommunityPlugin.mockResolvedValue(undefined);
  mockInstallConfigureEnableCommunityPlugin.mockResolvedValue(undefined);
  buttonInstances.length = 0;
  mockImplementation({
    $object: ButtonComponentOriginal.prototype,
    impl: function impl(this: ButtonComponentOriginal, originalImplementation, containerEl: HTMLElement): ButtonComponentOriginal {
      originalImplementation.call(this, containerEl);
      buttonInstances.push(this);
      return this;
    },
    method: 'constructor2__'
  });
});

function clickButton(index: number): void {
  const button = buttonInstances[index];
  if (!button) {
    throw new Error(`No button at index ${String(index)}.`);
  }
  castTo<ButtonComponent>(button).simulateClick__();
}

function createComponent(options: CreateComponentOptions = {}): ComponentContext {
  let layoutReadyCallback: (() => void) | undefined;

  const enabledPlugins = new Set<string>(options.isEnabled ? [SUGGESTED_PLUGIN_ID] : []);

  // A null-prototype record so a missing key reads as `undefined` (plugin not installed) rather than
  // Resolving up the prototype chain.
  const manifests: AppOriginal['plugins']['manifests'] = {};
  Object.setPrototypeOf(manifests, null);
  if (options.isEnabled || options.isInstalled) {
    manifests[SUGGESTED_PLUGIN_ID] = strictProxy<PluginManifest>({ id: SUGGESTED_PLUGIN_ID });
  }

  const app = strictProxy<AppOriginal>({
    plugins: strictProxy<AppOriginal['plugins']>({
      enabledPlugins,
      manifests
    }),
    workspace: {
      onLayoutReady: vi.fn((callback: () => void) => {
        layoutReadyCallback = callback;
      })
    }
  });

  const showNotice = vi.fn();
  const setSuggestionDeclined: SetSuggestionDeclinedMock = vi.fn<(isDeclined: boolean) => Promise<void>>().mockResolvedValue();
  let isDeclined = options.isDeclined ?? false;

  // The host's settings load, as the component sees it: already settled on a cold start, still in flight
  // Whenever the component loads onto a layout that is already ready.
  let resolveSettingsLoad = noop;
  const settingsLoadPromise = options.isSettingsLoadPending
    ? new Promise<void>((resolve) => {
      resolveSettingsLoad = resolve;
    })
    : noopAsync();

  const component = new PluginSuggestionComponent({
    app,
    isSuggestionDeclined: (): boolean => isDeclined,
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice }),
    pluginSettingsComponent: strictProxy<PluginSettingsComponentBase<object>>({
      whenLoadedFromFile: (): Promise<void> => settingsLoadPromise
    }),
    reason: REASON,
    setSuggestionDeclined: async (isDeclinedNew: boolean): Promise<void> => {
      isDeclined = isDeclinedNew;
      await setSuggestionDeclined(isDeclinedNew);
    },
    suggestedPluginId: SUGGESTED_PLUGIN_ID,
    suggestedPluginName: SUGGESTED_PLUGIN_NAME
  });

  return {
    app,
    component,
    finishSettingsLoad: (isDeclinedFromFile?: boolean): void => {
      if (isDeclinedFromFile !== undefined) {
        isDeclined = isDeclinedFromFile;
      }
      resolveSettingsLoad();
    },
    setSuggestionDeclined,
    showNotice,
    triggerLayoutReady: (): void => {
      layoutReadyCallback?.();
    }
  };
}

describe('getSuggestedPluginState', () => {
  it('should report Enabled when the suggested plugin is enabled', () => {
    const { component } = createComponent({ isEnabled: true });
    expect(component.getSuggestedPluginState()).toBe(SuggestedPluginState.Enabled);
  });

  it('should report InstalledButDisabled when the suggested plugin is installed but not enabled', () => {
    const { component } = createComponent({ isInstalled: true });
    expect(component.getSuggestedPluginState()).toBe(SuggestedPluginState.InstalledButDisabled);
  });

  it('should report NotInstalled when the suggested plugin is absent', () => {
    const { component } = createComponent();
    expect(component.getSuggestedPluginState()).toBe(SuggestedPluginState.NotInstalled);
  });
});

describe('onload', () => {
  it('should show the suggestion notice once the layout is ready', async () => {
    vi.useFakeTimers();
    const { component, showNotice, triggerLayoutReady } = createComponent();

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    expect(showNotice).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('should not show the notice when the suggested plugin is already enabled', async () => {
    vi.useFakeTimers();
    const { component, showNotice, triggerLayoutReady } = createComponent({ isEnabled: true });

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    expect(showNotice).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not show the notice when the suggestion was declined', async () => {
    vi.useFakeTimers();
    const { component, showNotice, triggerLayoutReady } = createComponent({ isDeclined: true });

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    expect(showNotice).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not decide the notice while the host settings are still loading', async () => {
    vi.useFakeTimers();
    const { component, finishSettingsLoad, showNotice, triggerLayoutReady } = createComponent({ isSettingsLoadPending: true });

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    expect(showNotice).not.toHaveBeenCalled();

    // The wait is a TRACKED async operation, so leaving it pending would hang the harness `afterEach` that
    // Drains them — and take every later test in this file down with it.
    finishSettingsLoad(true);
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('should not show the notice when the loading host settings turn out to hold a decline', async () => {
    // The regression this component was built to fail: on a layout that is ALREADY ready (a runtime enable,
    // Or a re-enable after an update) the layout-ready callback fires while the host's settings are still
    // Being read, so deciding right then sees the default `false` and asks a user who already declined.
    vi.useFakeTimers();
    const { component, finishSettingsLoad, showNotice, triggerLayoutReady } = createComponent({ isSettingsLoadPending: true });

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();
    finishSettingsLoad(true);
    await vi.runAllTimersAsync();

    expect(showNotice).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should show the notice once the host settings arrive without a decline', async () => {
    vi.useFakeTimers();
    const { component, finishSettingsLoad, showNotice, triggerLayoutReady } = createComponent({ isSettingsLoadPending: true });

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();
    finishSettingsLoad(false);
    await vi.runAllTimersAsync();

    expect(showNotice).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('should not show the notice when the component is unloaded while the host settings are loading', async () => {
    vi.useFakeTimers();
    const { component, finishSettingsLoad, showNotice, triggerLayoutReady } = createComponent({ isSettingsLoadPending: true });

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();
    component.unload();
    finishSettingsLoad();
    await vi.runAllTimersAsync();

    expect(showNotice).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should install the suggested plugin when the notice action button is clicked', async () => {
    vi.useFakeTimers();
    const { component, triggerLayoutReady } = createComponent();

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();
    clickButton(0);
    await vi.runAllTimersAsync();

    expect(mockInstallConfigureEnableCommunityPlugin).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('should record the decline when the notice Not now button is clicked', async () => {
    vi.useFakeTimers();
    const { component, setSuggestionDeclined, triggerLayoutReady } = createComponent();

    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();
    clickButton(1);
    await vi.runAllTimersAsync();

    expect(setSuggestionDeclined).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });
});

describe('renderBanner', () => {
  it('should render nothing when the suggested plugin is enabled', () => {
    const { component } = createComponent({ isEnabled: true });
    const containerEl = createDiv();

    component.renderBanner(containerEl);

    expect(containerEl.childElementCount).toBe(0);
  });

  it('should render the reason and an install button when the suggested plugin is absent', () => {
    const { component } = createComponent();
    const containerEl = createDiv();

    component.renderBanner(containerEl);

    expect(containerEl.textContent).toContain(REASON);
    expect(buttonInstances).toHaveLength(1);
    expect(buttonInstances[0]?.buttonEl.textContent).toBe('Install and enable');
  });

  it('should offer to enable when the suggested plugin is installed but disabled', () => {
    const { component } = createComponent({ isInstalled: true });
    const containerEl = createDiv();

    component.renderBanner(containerEl);

    expect(buttonInstances[0]?.buttonEl.textContent).toBe('Enable');
  });

  it('should install the suggested plugin when the banner button is clicked', async () => {
    const { component } = createComponent();
    const containerEl = createDiv();

    component.renderBanner(containerEl);
    clickButton(0);
    await vi.waitFor(() => {
      expect(mockInstallConfigureEnableCommunityPlugin).toHaveBeenCalledOnce();
    });
  });
});

describe('installAndEnableSuggestedPlugin', () => {
  it('should do nothing when the suggested plugin is already enabled', async () => {
    const { component } = createComponent({ isEnabled: true });

    await component.installAndEnableSuggestedPlugin();

    expect(mockEnableCommunityPlugin).not.toHaveBeenCalled();
    expect(mockInstallConfigureEnableCommunityPlugin).not.toHaveBeenCalled();
  });

  it('should only enable an already-installed suggested plugin', async () => {
    const { app, component } = createComponent({ isInstalled: true });

    await component.installAndEnableSuggestedPlugin();

    expect(mockEnableCommunityPlugin).toHaveBeenCalledWith({
      app,
      pluginId: SUGGESTED_PLUGIN_ID
    });
    expect(mockInstallConfigureEnableCommunityPlugin).not.toHaveBeenCalled();
  });

  it('should install and enable an absent suggested plugin, then clear the decline', async () => {
    const { app, component, setSuggestionDeclined, showNotice } = createComponent({ isDeclined: true });

    await component.installAndEnableSuggestedPlugin();

    expect(mockInstallConfigureEnableCommunityPlugin).toHaveBeenCalledWith({
      app,
      pluginId: SUGGESTED_PLUGIN_ID
    });
    expect(setSuggestionDeclined).toHaveBeenCalledWith(false);
    expect(showNotice).toHaveBeenCalledWith(`${SUGGESTED_PLUGIN_NAME} is installed and enabled.`);
  });

  it('should report a failed install and rethrow', async () => {
    const { component, showNotice } = createComponent();
    const error = new Error('install failed');
    mockInstallConfigureEnableCommunityPlugin.mockRejectedValue(error);

    await expect(component.installAndEnableSuggestedPlugin()).rejects.toThrow(error);

    expect(showNotice).toHaveBeenCalledWith(
      `Failed to install ${SUGGESTED_PLUGIN_NAME}. Check the console for more information.`
    );
  });
});
