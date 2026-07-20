import type {
  App,
  DataAdapter,
  PluginManifest,
  RequestUrlParam,
  Vault
} from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../function.ts';
import { strictProxy } from '../strict-proxy.ts';
import { EMPTY } from '../string.ts';
import {
  configureCommunityPlugin,
  disableCommunityPlugin,
  enableCommunityPlugin,
  getCommunityPluginRepo,
  getLatestReleaseVersion,
  installCommunityPlugin,
  installConfigureEnableCommunityPlugin,
  searchCommunityPlugins,
  toggleEnableCommunityPlugin,
  toggleInstallCommunityPlugin,
  uninstallCommunityPlugin
} from './community-plugins.ts';

interface AppMock {
  readonly adapterWrite: DataAdapter['write'];
  readonly app: App;
  readonly disablePluginAndSave: App['plugins']['disablePluginAndSave'];
  readonly enablePluginAndSave: App['plugins']['enablePluginAndSave'];
  readonly installPlugin: App['plugins']['installPlugin'];
  readonly uninstallPlugin: App['plugins']['uninstallPlugin'];
}

interface CreateAppOptions {
  readonly enabledIds?: string[];
  readonly existingPluginData?: object;
  readonly existingRawPluginData?: string;
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
  const enabledPlugins = new Set(options.enabledIds ?? []);
  const disablePluginAndSave = vi.fn<App['plugins']['disablePluginAndSave']>().mockImplementation((id) => {
    enabledPlugins.delete(id);
    return noopAsync();
  });
  const enablePluginAndSave = vi.fn<App['plugins']['enablePluginAndSave']>().mockImplementation((id) => {
    enabledPlugins.add(id);
    return noopAsync();
  });
  const installPlugin = vi.fn<App['plugins']['installPlugin']>().mockResolvedValue();
  const uninstallPlugin = vi.fn<App['plugins']['uninstallPlugin']>().mockResolvedValue();

  // A null-prototype record so the strict proxy does not re-wrap it: missing-key reads must return
  // `undefined` (plugin not installed), not throw as an unmocked-property access.
  const manifests: App['plugins']['manifests'] = {};
  Object.setPrototypeOf(manifests, null);
  for (const id of options.installedIds ?? []) {
    manifests[id] = strictProxy<PluginManifest>({ id });
  }

  const existingData = options.existingRawPluginData
    ?? (options.existingPluginData === undefined ? undefined : JSON.stringify(options.existingPluginData));
  const adapterExists = vi.fn<DataAdapter['exists']>().mockResolvedValue(existingData !== undefined);
  const adapterRead = vi.fn<DataAdapter['read']>().mockResolvedValue(existingData ?? '{}');
  const adapterWrite = vi.fn<DataAdapter['write']>().mockResolvedValue();

  const app = strictProxy<App>({
    plugins: strictProxy<App['plugins']>({
      disablePluginAndSave,
      enabledPlugins,
      enablePluginAndSave,
      installPlugin,
      manifests,
      uninstallPlugin
    }),
    vault: strictProxy<Vault>({
      adapter: strictProxy<DataAdapter>({
        exists: adapterExists,
        read: adapterRead,
        write: adapterWrite
      }),
      configDir: `${EMPTY}.obsidian`
    })
  });

  return {
    adapterWrite,
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

describe('installConfigureEnableCommunityPlugin', () => {
  it('should configure then enable a not-yet-enabled plugin', async () => {
    const { adapterWrite, app, disablePluginAndSave, enablePluginAndSave } = createApp({ installedIds: ['plugin-a'] });
    await installConfigureEnableCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'root-x' } });
    expect(adapterWrite).toHaveBeenCalled();
    expect(enablePluginAndSave).toHaveBeenCalledWith('plugin-a');
    expect(disablePluginAndSave).not.toHaveBeenCalled();
  });

  it('should skip configuration when no settings are given', async () => {
    const { adapterWrite, app, enablePluginAndSave } = createApp({ installedIds: ['plugin-a'] });
    await installConfigureEnableCommunityPlugin({ app, pluginId: 'plugin-a' });
    expect(adapterWrite).not.toHaveBeenCalled();
    expect(enablePluginAndSave).toHaveBeenCalledWith('plugin-a');
  });

  it('should disable and re-enable an already-enabled plugin when settings change', async () => {
    const { app, disablePluginAndSave, enablePluginAndSave } = createApp({
      enabledIds: ['plugin-a'],
      existingPluginData: { modulesRoot: 'old' },
      installedIds: ['plugin-a']
    });
    await installConfigureEnableCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'new' } });
    expect(disablePluginAndSave).toHaveBeenCalledWith('plugin-a');
    expect(enablePluginAndSave).toHaveBeenCalledWith('plugin-a');
  });

  it('should not toggle an already-enabled plugin when settings are unchanged', async () => {
    const { app, disablePluginAndSave, enablePluginAndSave } = createApp({
      enabledIds: ['plugin-a'],
      existingPluginData: { modulesRoot: 'same' },
      installedIds: ['plugin-a']
    });
    await installConfigureEnableCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'same' } });
    expect(disablePluginAndSave).not.toHaveBeenCalled();
    expect(enablePluginAndSave).not.toHaveBeenCalled();
  });
});

describe('configureCommunityPlugin', () => {
  const DATA_PATH = `${EMPTY}.obsidian/plugins/plugin-a/data.json`;

  it('should create data.json with the settings when none exists', async () => {
    const { adapterWrite, app } = createApp();
    await configureCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'root-x' } });
    expect(adapterWrite).toHaveBeenCalledWith(DATA_PATH, `${JSON.stringify({ modulesRoot: 'root-x' }, null, 2)}\n`);
  });

  it('should shallow-merge the settings over an existing data.json', async () => {
    const { adapterWrite, app } = createApp({ existingPluginData: { existing: 1, modulesRoot: 'old' } });
    await configureCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'new' } });
    expect(adapterWrite).toHaveBeenCalledWith(DATA_PATH, `${JSON.stringify({ existing: 1, modulesRoot: 'new' }, null, 2)}\n`);
  });

  it('should ignore a non-object existing data.json', async () => {
    const { adapterWrite, app } = createApp({ existingRawPluginData: 'null' });
    await configureCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'x' } });
    expect(adapterWrite).toHaveBeenCalledWith(DATA_PATH, `${JSON.stringify({ modulesRoot: 'x' }, null, 2)}\n`);
  });

  it('should return true when it changes data.json', async () => {
    const { app } = createApp();
    expect(await configureCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'root-x' } })).toBe(true);
  });

  it('should return false and not write when the settings are already present', async () => {
    const { adapterWrite, app } = createApp({ existingPluginData: { modulesRoot: 'root-x' } });
    const result = await configureCommunityPlugin({ app, pluginId: 'plugin-a', settings: { modulesRoot: 'root-x' } });
    expect(result).toBe(false);
    expect(adapterWrite).not.toHaveBeenCalled();
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

describe('selecting a plugin by name', () => {
  it('should install by pluginName', async () => {
    mockRegistryAndReleases();
    const { app, installPlugin } = createApp();
    await installCommunityPlugin({ app, pluginName: 'Plugin A' });
    expect(installPlugin).toHaveBeenCalledWith('owner-a/plugin-a', LATEST_VERSION, MANIFEST);
  });

  it('should enable by pluginName', async () => {
    const { app, enablePluginAndSave } = createApp();
    await enableCommunityPlugin({ app, pluginName: 'Plugin A' });
    expect(enablePluginAndSave).toHaveBeenCalledWith('plugin-a');
  });

  it('should configure by pluginName', async () => {
    const { adapterWrite, app } = createApp();
    await configureCommunityPlugin({ app, pluginName: 'Plugin A', settings: { modulesRoot: 'root-x' } });
    expect(adapterWrite).toHaveBeenCalledWith(`${EMPTY}.obsidian/plugins/plugin-a/data.json`, `${JSON.stringify({ modulesRoot: 'root-x' }, null, 2)}\n`);
  });

  it('should uninstall by pluginName', async () => {
    const { app, uninstallPlugin } = createApp({ installedIds: ['plugin-a'] });
    await uninstallCommunityPlugin({ app, pluginName: 'Plugin A' });
    expect(uninstallPlugin).toHaveBeenCalledWith('plugin-a');
  });

  it('should toggle-install by pluginName', async () => {
    mockRegistryAndReleases();
    const { app, installPlugin } = createApp();
    await toggleInstallCommunityPlugin({ app, isInstalled: true, pluginName: 'Plugin A' });
    expect(installPlugin).toHaveBeenCalledWith('owner-a/plugin-a', LATEST_VERSION, MANIFEST);
  });

  it('should throw when the pluginName is not in the registry', async () => {
    const { app } = createApp();
    await expect(enableCommunityPlugin({ app, pluginName: 'No Such Plugin' }))
      .rejects.toThrow('Plugin named \'No Such Plugin\' was not found in the Obsidian community plugins registry.');
  });
});

describe('searchCommunityPlugins', () => {
  it('should match by id', async () => {
    expect(await searchCommunityPlugins('plugin-a')).toStrictEqual([{ id: 'plugin-a', name: 'Plugin A' }]);
  });

  it('should match by name', async () => {
    expect(await searchCommunityPlugins('Plugin B')).toStrictEqual([{ id: 'plugin-b', name: 'Plugin B' }]);
  });

  it('should match by author case-insensitively', async () => {
    expect(await searchCommunityPlugins('author a')).toStrictEqual([{ id: 'plugin-a', name: 'Plugin A' }]);
  });

  it('should match by description', async () => {
    expect(await searchCommunityPlugins('Description B')).toStrictEqual([{ id: 'plugin-b', name: 'Plugin B' }]);
  });

  it('should return an empty list when nothing matches', async () => {
    expect(await searchCommunityPlugins('no-such-plugin')).toStrictEqual([]);
  });

  it('should return every plugin for an empty query', async () => {
    expect(await searchCommunityPlugins('')).toStrictEqual([
      { id: 'plugin-a', name: 'Plugin A' },
      { id: 'plugin-b', name: 'Plugin B' }
    ]);
  });
});
