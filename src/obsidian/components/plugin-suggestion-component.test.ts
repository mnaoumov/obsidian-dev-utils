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

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { mockImplementation } from '../../test-helpers/mock-implementation.ts';
import {
  PluginSuggestionComponent,
  SuggestedPluginState
} from './plugin-suggestion-component.ts';

interface CreateComponentOptions {
  readonly isDeclined?: boolean;
  readonly isEnabled?: boolean;
  readonly isInstalled?: boolean;
}

interface ComponentContext {
  readonly app: AppOriginal;
  readonly component: PluginSuggestionComponent;
  readonly setSuggestionDeclined: ReturnType<typeof vi.fn>;
  readonly showNotice: ReturnType<typeof vi.fn>;
  triggerLayoutReady(): void;
}

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
  const setSuggestionDeclined = vi.fn().mockResolvedValue(undefined);
  let isDeclined = options.isDeclined ?? false;

  const component = new PluginSuggestionComponent({
    app,
    isSuggestionDeclined: () => isDeclined,
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice }),
    reason: REASON,
    setSuggestionDeclined: (value: boolean) => {
      isDeclined = value;
      return setSuggestionDeclined(value);
    },
    suggestedPluginId: SUGGESTED_PLUGIN_ID,
    suggestedPluginName: SUGGESTED_PLUGIN_NAME
  });

  return {
    app,
    component,
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
  it('should show the suggestion notice once the layout is ready', () => {
    vi.useFakeTimers();
    const { component, showNotice, triggerLayoutReady } = createComponent();

    component.load();
    triggerLayoutReady();
    vi.runAllTimers();

    expect(showNotice).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('should not show the notice when the suggested plugin is already enabled', () => {
    vi.useFakeTimers();
    const { component, showNotice, triggerLayoutReady } = createComponent({ isEnabled: true });

    component.load();
    triggerLayoutReady();
    vi.runAllTimers();

    expect(showNotice).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not show the notice when the suggestion was declined', () => {
    vi.useFakeTimers();
    const { component, showNotice, triggerLayoutReady } = createComponent({ isDeclined: true });

    component.load();
    triggerLayoutReady();
    vi.runAllTimers();

    expect(showNotice).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should install the suggested plugin when the notice action button is clicked', async () => {
    vi.useFakeTimers();
    const { component, triggerLayoutReady } = createComponent();

    component.load();
    triggerLayoutReady();
    vi.runAllTimers();
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
    vi.runAllTimers();
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
