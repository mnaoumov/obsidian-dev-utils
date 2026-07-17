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

import { strictProxy } from '../strict-proxy.ts';
import { EMPTY } from '../string.ts';
import { bootstrapDemoVault } from './demo-vault-helper.ts';

const CST_PLUGIN_ID = 'fix-require-modules';
const CST_REPO = 'mnaoumov/obsidian-codescript-toolkit';
const CST_VERSION = '1.0.0';

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
const EXPECTED_SETTINGS_JSON = `${JSON.stringify({
  invocableScriptsFolder: 'Invocables',
  modulesRoot: '_assets/CodeScriptToolkit',
  shouldHandleProtocolUrls: true,
  startupScriptPath: 'startup.ts'
}, null, 2)}\n`;

interface AppMock {
  readonly adapterWrite: DataAdapter['write'];
  readonly app: App;
  readonly enablePluginAndSave: App['plugins']['enablePluginAndSave'];
  readonly installPlugin: App['plugins']['installPlugin'];
}

interface CreateAppOptions {
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
  const installPlugin = vi.fn<App['plugins']['installPlugin']>().mockResolvedValue();
  const enablePluginAndSave = vi.fn<App['plugins']['enablePluginAndSave']>().mockResolvedValue();
  const adapterExists = vi.fn<DataAdapter['exists']>().mockResolvedValue(false);
  const adapterRead = vi.fn<DataAdapter['read']>().mockResolvedValue('{}');
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
      enabledPlugins: new Set(options.isCstEnabled ? [CST_PLUGIN_ID] : []),
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
  it('should install CodeScript Toolkit from the store when it is not installed', async () => {
    const { app, installPlugin } = createApp();
    await bootstrapDemoVault({ app });
    expect(installPlugin).toHaveBeenCalledWith(CST_REPO, CST_VERSION, CST_MANIFEST);
  });

  it('should not reinstall CodeScript Toolkit when it is already installed', async () => {
    const { app, installPlugin } = createApp({ isCstInstalled: true });
    await bootstrapDemoVault({ app });
    expect(installPlugin).not.toHaveBeenCalled();
    expect(mockRequestUrl).not.toHaveBeenCalled();
  });

  it('should still configure CodeScript Toolkit when it is already installed', async () => {
    const { adapterWrite, app } = createApp({ isCstInstalled: true });
    await bootstrapDemoVault({ app });
    expect(adapterWrite).toHaveBeenCalledWith(DATA_PATH, EXPECTED_SETTINGS_JSON);
  });

  it('should write CodeScript Toolkit settings before enabling it (loads configured, no reload)', async () => {
    const { adapterWrite, app, enablePluginAndSave } = createApp();
    await bootstrapDemoVault({ app });
    expect(adapterWrite).toHaveBeenCalledWith(DATA_PATH, EXPECTED_SETTINGS_JSON);
    expect(enablePluginAndSave).toHaveBeenCalledWith(CST_PLUGIN_ID);
    const writeOrder = vi.mocked(adapterWrite).mock.invocationCallOrder[0] ?? 0;
    const enableOrder = vi.mocked(enablePluginAndSave).mock.invocationCallOrder[0] ?? 0;
    expect(writeOrder).toBeLessThan(enableOrder);
  });

  it('should not re-enable CodeScript Toolkit when it is already enabled', async () => {
    const { app, enablePluginAndSave } = createApp({ isCstEnabled: true, isCstInstalled: true });
    await bootstrapDemoVault({ app });
    expect(enablePluginAndSave).not.toHaveBeenCalled();
  });
});
