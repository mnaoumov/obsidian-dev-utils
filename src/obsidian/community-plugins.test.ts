import type {
  App,
  PluginManifest,
  RequestUrlParam
} from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import {
  disableCommunityPlugin,
  enableCommunityPlugin,
  getCommunityPluginRepo,
  getLatestReleaseVersion,
  installCommunityPlugin,
  toggleEnableCommunityPlugin,
  toggleInstallCommunityPlugin,
  uninstallCommunityPlugin
} from './community-plugins.ts';

interface AppMock {
  readonly app: App;
  readonly disablePluginAndSave: App['plugins']['disablePluginAndSave'];
  readonly enablePluginAndSave: App['plugins']['enablePluginAndSave'];
  readonly installPlugin: App['plugins']['installPlugin'];
  readonly uninstallPlugin: App['plugins']['uninstallPlugin'];
}

interface CreateAppOptions {
  readonly enabledIds?: string[];
  readonly installedIds?: string[];
}

const { mockRequestUrl } = vi.hoisted(() => ({
  mockRequestUrl: vi.fn()
}));

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    requestUrl: mockRequestUrl
  };
});

const REGISTRY = [
  {
    author: 'Author A',
    description: 'Description A',
    id: 'plugin-a',
    name: 'Plugin A',
    repo: 'owner-a/plugin-a'
  },
  {
    author: 'Author B',
    description: 'Description B',
    id: 'plugin-b',
    name: 'Plugin B',
    repo: 'owner-b/plugin-b'
  }
];

const LATEST_VERSION = '1.2.3';

const MANIFEST: PluginManifest = {
  author: 'Author A',
  description: 'Description A',
  id: 'plugin-a',
  minAppVersion: '1.0.0',
  name: 'Plugin A',
  version: LATEST_VERSION
};

function createApp(options: CreateAppOptions = {}): AppMock {
  const disablePluginAndSave = vi.fn<App['plugins']['disablePluginAndSave']>().mockResolvedValue();
  const enablePluginAndSave = vi.fn<App['plugins']['enablePluginAndSave']>().mockResolvedValue();
  const installPlugin = vi.fn<App['plugins']['installPlugin']>().mockResolvedValue();
  const uninstallPlugin = vi.fn<App['plugins']['uninstallPlugin']>().mockResolvedValue();

  // A null-prototype record so the strict proxy does not re-wrap it: missing-key reads must return
  // `undefined` (plugin not installed), not throw as an unmocked-property access.
  const manifests: App['plugins']['manifests'] = {};
  Object.setPrototypeOf(manifests, null);
  for (const id of options.installedIds ?? []) {
    manifests[id] = strictProxy<PluginManifest>({ id });
  }

  const app = strictProxy<App>({
    plugins: strictProxy<App['plugins']>({
      disablePluginAndSave,
      enabledPlugins: new Set(options.enabledIds ?? []),
      enablePluginAndSave,
      installPlugin,
      manifests,
      uninstallPlugin
    })
  });

  return {
    app,
    disablePluginAndSave,
    enablePluginAndSave,
    installPlugin,
    uninstallPlugin
  };
}

function mockRegistryAndReleases(): void {
  mockRequestUrl.mockImplementation((arg: RequestUrlParam | string) => {
    const url = typeof arg === 'string' ? arg : arg.url;
    if (url.includes('community-plugins.json')) {
      return Promise.resolve({ json: REGISTRY });
    }
    if (url.includes('releases/latest')) {
      // eslint-disable-next-line camelcase -- The field name is dictated by the GitHub API JSON.
      return Promise.resolve({ json: { tag_name: LATEST_VERSION } });
    }
    if (url.includes('manifest.json')) {
      return Promise.resolve({ json: MANIFEST });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestUrl.mockResolvedValue({ json: REGISTRY });
});

describe('getCommunityPluginRepo', () => {
  it('should return the repo for a listed plugin', async () => {
    expect(await getCommunityPluginRepo('plugin-b')).toBe('owner-b/plugin-b');
  });

  it('should return null for an unlisted plugin', async () => {
    expect(await getCommunityPluginRepo('missing-plugin')).toBeNull();
  });

  it('should fetch the registry only once across calls', async () => {
    await getCommunityPluginRepo('plugin-a');
    await getCommunityPluginRepo('plugin-b');
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
  });

  it('should not cache a failed fetch and retry on the next call', async () => {
    mockRequestUrl.mockRejectedValueOnce(new Error('network down'));
    await expect(getCommunityPluginRepo('plugin-a')).rejects.toThrow('network down');
    expect(await getCommunityPluginRepo('plugin-a')).toBe('owner-a/plugin-a');
    expect(mockRequestUrl).toHaveBeenCalledTimes(2);
  });
});

describe('getLatestReleaseVersion', () => {
  it('should return the latest release tag name', async () => {
    mockRegistryAndReleases();
    expect(await getLatestReleaseVersion('owner-a/plugin-a')).toBe(LATEST_VERSION);
  });
});

describe('installCommunityPlugin', () => {
  it('should install a plugin that is not yet installed', async () => {
    mockRegistryAndReleases();
    const { app, installPlugin } = createApp();
    await installCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(installPlugin).toHaveBeenCalledWith('owner-a/plugin-a', LATEST_VERSION, MANIFEST);
  });

  it('should be a no-op when the plugin is already installed', async () => {
    const { app, installPlugin } = createApp({ installedIds: ['plugin-a'] });
    await installCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(installPlugin).not.toHaveBeenCalled();
    expect(mockRequestUrl).not.toHaveBeenCalled();
  });

  it('should throw when the plugin is not listed in the registry', async () => {
    mockRegistryAndReleases();
    const { app } = createApp();
    await expect(installCommunityPlugin({ app, pluginId: 'missing-plugin' }))
      .rejects.toThrow('Plugin \'missing-plugin\' was not found in the Obsidian community plugins registry.');
  });
});

describe('uninstallCommunityPlugin', () => {
  it('should uninstall a plugin that is installed', async () => {
    const { app, uninstallPlugin } = createApp({ installedIds: ['plugin-a'] });
    await uninstallCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(uninstallPlugin).toHaveBeenCalledWith('plugin-a');
  });

  it('should be a no-op when the plugin is not installed', async () => {
    const { app, uninstallPlugin } = createApp();
    await uninstallCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(uninstallPlugin).not.toHaveBeenCalled();
  });
});

describe('toggleInstallCommunityPlugin', () => {
  it('should install when isInstalled is true', async () => {
    mockRegistryAndReleases();
    const { app, installPlugin } = createApp();
    await toggleInstallCommunityPlugin({ app, isInstalled: true, pluginId: 'plugin-a' });
    expect(installPlugin).toHaveBeenCalledWith('owner-a/plugin-a', LATEST_VERSION, MANIFEST);
  });

  it('should uninstall when isInstalled is false', async () => {
    const { app, uninstallPlugin } = createApp({ installedIds: ['plugin-a'] });
    await toggleInstallCommunityPlugin({ app, isInstalled: false, pluginId: 'plugin-a' });
    expect(uninstallPlugin).toHaveBeenCalledWith('plugin-a');
  });
});

describe('enableCommunityPlugin', () => {
  it('should enable a plugin that is disabled', async () => {
    const { app, enablePluginAndSave } = createApp();
    await enableCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(enablePluginAndSave).toHaveBeenCalledWith('plugin-a');
  });

  it('should be a no-op when the plugin is already enabled', async () => {
    const { app, enablePluginAndSave } = createApp({ enabledIds: ['plugin-a'] });
    await enableCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(enablePluginAndSave).not.toHaveBeenCalled();
  });
});

describe('disableCommunityPlugin', () => {
  it('should disable a plugin that is enabled', async () => {
    const { app, disablePluginAndSave } = createApp({ enabledIds: ['plugin-a'] });
    await disableCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(disablePluginAndSave).toHaveBeenCalledWith('plugin-a');
  });

  it('should be a no-op when the plugin is already disabled', async () => {
    const { app, disablePluginAndSave } = createApp();
    await disableCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(disablePluginAndSave).not.toHaveBeenCalled();
  });
});

describe('toggleEnableCommunityPlugin', () => {
  it('should enable when isEnabled is true', async () => {
    const { app, enablePluginAndSave } = createApp();
    await toggleEnableCommunityPlugin({ app, isEnabled: true, pluginId: 'plugin-a' });
    expect(enablePluginAndSave).toHaveBeenCalledWith('plugin-a');
  });

  it('should disable when isEnabled is false', async () => {
    const { app, disablePluginAndSave } = createApp({ enabledIds: ['plugin-a'] });
    await toggleEnableCommunityPlugin({ app, isEnabled: false, pluginId: 'plugin-a' });
    expect(disablePluginAndSave).toHaveBeenCalledWith('plugin-a');
  });
});
