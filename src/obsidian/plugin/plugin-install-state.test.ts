// @vitest-environment jsdom

/**
 * @file
 *
 * Tests for the shared install-state helpers.
 */

import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginNoticeComponent } from '../components/plugin-notice-component.ts';

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import {
  getInstalledPluginState,
  getInstalledPluginVersion,
  installAndEnablePlugin,
  InstalledPluginState
} from './plugin-install-state.ts';

const PLUGIN_ID = 'required-plugin';
const PLUGIN_NAME = 'Required Plugin';

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

let app: AppOriginal;
let enabledPlugins: Set<string>;
let manifests: AppOriginal['plugins']['manifests'];
let showNotice: ReturnType<typeof vi.fn>;

beforeEach(() => {
  enabledPlugins = new Set<string>();

  // A null-prototype record so a missing key reads as `undefined` (plugin not installed) rather than
  // resolving up the prototype chain.
  manifests = {};
  Object.setPrototypeOf(manifests, null);

  app = strictProxy<AppOriginal>({
    plugins: strictProxy<AppOriginal['plugins']>({
      enabledPlugins,
      manifests
    })
  });

  showNotice = vi.fn();
  mockEnableCommunityPlugin.mockResolvedValue(undefined);
  mockInstallConfigureEnableCommunityPlugin.mockResolvedValue(undefined);
});

describe('getInstalledPluginState', () => {
  it('should report NotInstalled when the plugin has no manifest', () => {
    expect(getInstalledPluginState({ app, pluginId: PLUGIN_ID })).toBe(InstalledPluginState.NotInstalled);
  });

  it('should report InstalledButDisabled when a manifest exists but the plugin is not enabled', () => {
    setInstalled();

    expect(getInstalledPluginState({ app, pluginId: PLUGIN_ID })).toBe(InstalledPluginState.InstalledButDisabled);
  });

  it('should report Enabled when the plugin is in the enabled set', () => {
    setInstalled();
    enabledPlugins.add(PLUGIN_ID);

    expect(getInstalledPluginState({ app, pluginId: PLUGIN_ID })).toBe(InstalledPluginState.Enabled);
  });
});

describe('getInstalledPluginVersion', () => {
  it('should report null when the plugin is not installed', () => {
    expect(getInstalledPluginVersion({ app, pluginId: PLUGIN_ID })).toBeNull();
  });

  it('should report null when the plugin is installed but disabled, because it registers nothing', () => {
    setInstalledVersion('1.2.3');

    expect(getInstalledPluginVersion({ app, pluginId: PLUGIN_ID })).toBeNull();
  });

  it('should report the manifest version when the plugin is enabled', () => {
    setInstalledVersion('1.2.3');
    enabledPlugins.add(PLUGIN_ID);

    expect(getInstalledPluginVersion({ app, pluginId: PLUGIN_ID })).toBe('1.2.3');
  });

  it('should report an empty string for an enabled plugin whose manifest carries no version, so it stays distinguishable from absent', () => {
    // Cast rather than `strictProxy`: the point of this case is a manifest where `version` is genuinely
    // missing, which a strict proxy would turn into a throw instead of the `undefined` the code reads.
    manifests[PLUGIN_ID] = castTo<PluginManifest>({ id: PLUGIN_ID });
    enabledPlugins.add(PLUGIN_ID);

    expect(getInstalledPluginVersion({ app, pluginId: PLUGIN_ID })).toBe('');
  });
});

describe('installAndEnablePlugin', () => {
  it('should do nothing when the plugin is already enabled', async () => {
    setInstalled();
    enabledPlugins.add(PLUGIN_ID);

    await installAndEnablePlugin(createParams());

    expect(mockEnableCommunityPlugin).not.toHaveBeenCalled();
    expect(mockInstallConfigureEnableCommunityPlugin).not.toHaveBeenCalled();
    expect(showNotice).not.toHaveBeenCalled();
  });

  it('should only enable an installed-but-disabled plugin, so no download happens', async () => {
    setInstalled();

    await installAndEnablePlugin(createParams());

    expect(mockEnableCommunityPlugin).toHaveBeenCalledWith({ app, pluginId: PLUGIN_ID });
    expect(mockInstallConfigureEnableCommunityPlugin).not.toHaveBeenCalled();
  });

  it('should install and enable a plugin that is not installed', async () => {
    await installAndEnablePlugin(createParams());

    expect(mockInstallConfigureEnableCommunityPlugin).toHaveBeenCalledWith({ app, pluginId: PLUGIN_ID });
  });

  it('should report success with the plugin name as a code block', async () => {
    await installAndEnablePlugin(createParams());

    expectNoticeText(`${PLUGIN_NAME} is installed and enabled.`);
  });

  it('should report a failure with the plugin name as a code block, and rethrow', async () => {
    const error = new Error('install failed');
    mockInstallConfigureEnableCommunityPlugin.mockRejectedValue(error);

    await expect(installAndEnablePlugin(createParams())).rejects.toThrow(error);

    expectNoticeText(`Failed to install ${PLUGIN_NAME}. Check the console for more information.`);
  });
});

function createParams(): Parameters<typeof installAndEnablePlugin>[0] {
  return {
    app,
    pluginId: PLUGIN_ID,
    pluginName: PLUGIN_NAME,
    pluginNoticeComponent: castTo<PluginNoticeComponent>({ showNotice })
  };
}

// The plugin name is rendered as an inline code block, so the notice is a `DocumentFragment` and its text
// content is what the user reads. Asserting on that keeps the test about the message rather than markup.
function expectNoticeText(expectedText: string): void {
  const message: unknown = showNotice.mock.calls[0]?.[0];
  expect(message).toBeInstanceOf(DocumentFragment);
  expect(castTo<DocumentFragment>(message).textContent).toBe(expectedText);
  expect(castTo<DocumentFragment>(message).querySelector('code')?.textContent).toBe(PLUGIN_NAME);
}

function setInstalled(): void {
  manifests[PLUGIN_ID] = strictProxy<PluginManifest>({ id: PLUGIN_ID });
}

function setInstalledVersion(version: string): void {
  manifests[PLUGIN_ID] = strictProxy<PluginManifest>({
    id: PLUGIN_ID,
    version
  });
}
