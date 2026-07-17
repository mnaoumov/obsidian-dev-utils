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
import { bootstrapDemoVault } from './demo-vault-helper.ts';

const CST_PLUGIN_ID = 'fix-require-modules';
const CST_REPO = 'mnaoumov/obsidian-codescript-toolkit';
const CST_VERSION = '1.0.0';

const CST_SETTINGS = {
  invocableScriptsFolder: 'Invocables',
  modulesRoot: '_assets/CodeScriptToolkit',
  shouldHandleProtocolUrls: true,
  startupScriptPath: 'startup.ts'
};

const CST_MANIFEST: PluginManifest = {
  author: 'mnaoumov',
  description: 'CodeScript Toolkit',
  id: CST_PLUGIN_ID,
  minAppVersion: '1.0.0',
  name: 'CodeScript Toolkit',
  version: CST_VERSION
};

const REGISTRY = [
  {
    author: 'mnaoumov',
    description: 'CodeScript Toolkit',
    id: CST_PLUGIN_ID,
    name: 'CodeScript Toolkit',
    repo: CST_REPO
  }
];

const DATA_PATH = `${EMPTY}.obsidian/plugins/${CST_PLUGIN_ID}/data.json`;

interface AppMock {
  readonly adapterWrite: DataAdapter['write'];
  readonly app: App;
  readonly disablePluginAndSave: App['plugins']['disablePluginAndSave'];
  readonly enablePluginAndSave: App['plugins']['enablePluginAndSave'];
  readonly installPlugin: App['plugins']['installPlugin'];
}

interface CreateAppOptions {
  readonly existingData?: string;
  readonly isCstEnabled?: boolean;
  readonly isCstInstalled?: boolean;
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

function createApp(options: CreateAppOptions = {}): AppMock {
  // A live set the enable/disable mocks mutate, so the real community-plugin helpers observe the change
  // (an already-enabled plugin is seen as enabled until disabled, and vice versa).
  const enabledPlugins = new Set<string>(options.isCstEnabled ? [CST_PLUGIN_ID] : []);
  const installPlugin = vi.fn<App['plugins']['installPlugin']>().mockResolvedValue();
  const enablePluginAndSave = vi.fn<App['plugins']['enablePluginAndSave']>().mockImplementation((id: string) => {
    enabledPlugins.add(id);
    return noopAsync();
  });
  const disablePluginAndSave = vi.fn<App['plugins']['disablePluginAndSave']>().mockImplementation((id: string) => {
    enabledPlugins.delete(id);
    return noopAsync();
  });

  const adapterExists = vi.fn<DataAdapter['exists']>().mockResolvedValue(options.existingData !== undefined);
  const adapterRead = vi.fn<DataAdapter['read']>().mockResolvedValue(options.existingData ?? '{}');
  const adapterWrite = vi.fn<DataAdapter['write']>().mockResolvedValue();

  // A null-prototype record so the strict proxy does not re-wrap it: a missing key reads as `undefined`
  // (plugin not installed) instead of throwing.
  const manifests: App['plugins']['manifests'] = {};
  Object.setPrototypeOf(manifests, null);
  if (options.isCstInstalled) {
    manifests[CST_PLUGIN_ID] = strictProxy<PluginManifest>({ id: CST_PLUGIN_ID });
  }

  const app = strictProxy<App>({
    plugins: strictProxy<App['plugins']>({
      disablePluginAndSave,
      enabledPlugins,
      enablePluginAndSave,
      installPlugin,
      manifests
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
    installPlugin
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestUrl.mockImplementation((arg: RequestUrlParam | string) => {
    const url = typeof arg === 'string' ? arg : arg.url;
    if (url.includes('community-plugins.json')) {
      return Promise.resolve({ json: REGISTRY });
    }
    if (url.includes('releases/latest')) {
      // eslint-disable-next-line camelcase -- The field name is dictated by the GitHub API JSON.
      return Promise.resolve({ json: { tag_name: CST_VERSION } });
    }
    if (url.includes('manifest.json')) {
      return Promise.resolve({ json: CST_MANIFEST });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
});

describe('bootstrapDemoVault', () => {
  it('should install CodeScript Toolkit from the store when it is not installed, then enable it', async () => {
    const { app, enablePluginAndSave, installPlugin } = createApp();
    await bootstrapDemoVault({ app });
    expect(installPlugin).toHaveBeenCalledWith(CST_REPO, CST_VERSION, CST_MANIFEST);
    expect(enablePluginAndSave).toHaveBeenCalledWith(CST_PLUGIN_ID);
  });

  it('should not reinstall CodeScript Toolkit when it is already installed', async () => {
    const { app, installPlugin } = createApp({ isCstInstalled: true });
    await bootstrapDemoVault({ app });
    expect(installPlugin).not.toHaveBeenCalled();
    expect(mockRequestUrl).not.toHaveBeenCalled();
  });

  it('should write CodeScript Toolkit settings before enabling it (fresh load, no reload)', async () => {
    const { adapterWrite, app, disablePluginAndSave, enablePluginAndSave } = createApp();
    await bootstrapDemoVault({ app });
    expect(adapterWrite).toHaveBeenCalledWith(DATA_PATH, `${JSON.stringify(CST_SETTINGS, null, 2)}\n`);
    expect(enablePluginAndSave).toHaveBeenCalledWith(CST_PLUGIN_ID);
    expect(disablePluginAndSave).not.toHaveBeenCalled();
    const writeOrder = vi.mocked(adapterWrite).mock.invocationCallOrder[0] ?? 0;
    const enableOrder = vi.mocked(enablePluginAndSave).mock.invocationCallOrder[0] ?? 0;
    expect(writeOrder).toBeLessThan(enableOrder);
  });

  it('should reload CodeScript Toolkit when it is already enabled but the settings changed', async () => {
    const { app, disablePluginAndSave, enablePluginAndSave, installPlugin } = createApp({
      existingData: JSON.stringify({ modulesRoot: 'stale' }),
      isCstEnabled: true,
      isCstInstalled: true
    });
    await bootstrapDemoVault({ app });
    expect(installPlugin).not.toHaveBeenCalled();
    expect(disablePluginAndSave).toHaveBeenCalledWith(CST_PLUGIN_ID);
    expect(enablePluginAndSave).toHaveBeenCalledWith(CST_PLUGIN_ID);
  });

  it('should not reload CodeScript Toolkit when it is already enabled and the settings are unchanged', async () => {
    const { adapterWrite, app, disablePluginAndSave, enablePluginAndSave } = createApp({
      existingData: JSON.stringify(CST_SETTINGS),
      isCstEnabled: true,
      isCstInstalled: true
    });
    await bootstrapDemoVault({ app });
    expect(adapterWrite).not.toHaveBeenCalled();
    expect(disablePluginAndSave).not.toHaveBeenCalled();
    expect(enablePluginAndSave).not.toHaveBeenCalled();
  });
});
