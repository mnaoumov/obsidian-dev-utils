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

const HELPER_PLUGIN_ID = 'demo-vault-helper';
const DEMOED_PLUGIN_ID = 'my-plugin';
const DEMOED_PLUGIN_NAME = 'My Plugin';
const VAULT_BASE_PATH = '/tmp/obsidian-demo-vaults/extracted/my-plugin-1.2.3.demo-vault';
const PERMANENT_NOTICE_DURATION_IN_MILLISECONDS = 0;

const CST_SETTINGS = {
  defaultCodeButtonConfig: '---\nsourceVisibility: collapsed\n---',
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

const PLUGINS_FOLDER_PATH = `${EMPTY}.obsidian/plugins`;
const DATA_PATH = `${PLUGINS_FOLDER_PATH}/${CST_PLUGIN_ID}/data.json`;
const INVOCABLE_SCRIPTS_FOLDER_PATH = `${CST_SETTINGS.modulesRoot}/${CST_SETTINGS.invocableScriptsFolder}`;

interface AdapterMembers {
  exists: DataAdapter['exists'];
  // Explicitly `undefined` rather than absent for the mobile-adapter case: the strict proxy throws on a
  // Property it has never heard of, whereas a real mobile adapter just reads as `undefined` — which is
  // The value the code under test actually branches on.
  getBasePath?: (() => string) | undefined;
  list: DataAdapter['list'];
  mkdir: DataAdapter['mkdir'];
  read: DataAdapter['read'];
  write: DataAdapter['write'];
}

interface AppMock {
  readonly adapterList: DataAdapter['list'];
  readonly adapterMkdir: DataAdapter['mkdir'];
  readonly adapterWrite: DataAdapter['write'];
  readonly app: App;
  readonly disablePluginAndSave: App['plugins']['disablePluginAndSave'];
  readonly enablePluginAndSave: App['plugins']['enablePluginAndSave'];
  readonly installPlugin: App['plugins']['installPlugin'];
}

interface CreateAppOptions {
  readonly existingData?: string;
  readonly hasVaultBasePath?: boolean;
  readonly isCstEnabled?: boolean;
  readonly isCstInstalled?: boolean;
  readonly isDemoedPluginManifestPresent?: boolean;
  readonly isInvocableScriptsFolderPresent?: boolean;
  readonly isPluginsFolderPresent?: boolean;
  readonly pluginFolderIds?: string[];
}

const { mockNotice, mockRequestUrl } = vi.hoisted(() => ({
  mockNotice: vi.fn<(message: DocumentFragment | string, durationInMilliseconds?: number) => void>(),
  mockRequestUrl: vi.fn()
}));

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    // The sandbox notice is the one thing here that reaches the real Obsidian UI, so the constructor is
    // Recorded rather than run — the tests assert on the message and the duration it was asked for.
    Notice: class Notice {
      public constructor(message: DocumentFragment | string, durationInMilliseconds?: number) {
        mockNotice(message, durationInMilliseconds);
      }

      // Part of the real `Notice` surface; a no-op here, since nothing under test hides the notice.
      public hide(): void {
        // Intentionally empty.
      }
    },
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

  const adapterExists = vi.fn<DataAdapter['exists']>().mockImplementation((path: string) => {
    switch (path) {
      case INVOCABLE_SCRIPTS_FOLDER_PATH: {
        return Promise.resolve(options.isInvocableScriptsFolderPresent ?? false);
      }
      case PLUGINS_FOLDER_PATH: {
        return Promise.resolve(options.isPluginsFolderPresent ?? true);
      }
      default: {
        return Promise.resolve(options.existingData !== undefined);
      }
    }
  });
  const adapterRead = vi.fn<DataAdapter['read']>().mockResolvedValue(options.existingData ?? '{}');
  const adapterWrite = vi.fn<DataAdapter['write']>().mockResolvedValue();
  const adapterMkdir = vi.fn<DataAdapter['mkdir']>().mockResolvedValue();
  const adapterList = vi.fn<DataAdapter['list']>().mockResolvedValue({
    files: [`${PLUGINS_FOLDER_PATH}/.DS_Store`],
    folders: (options.pluginFolderIds ?? [HELPER_PLUGIN_ID, DEMOED_PLUGIN_ID]).map((pluginId) => `${PLUGINS_FOLDER_PATH}/${pluginId}`)
  });

  // A null-prototype record so the strict proxy does not re-wrap it: a missing key reads as `undefined`
  // (plugin not installed) instead of throwing.
  const manifests: App['plugins']['manifests'] = {};
  Object.setPrototypeOf(manifests, null);
  if (options.isCstInstalled) {
    manifests[CST_PLUGIN_ID] = strictProxy<PluginManifest>({ id: CST_PLUGIN_ID });
  }
  if (options.isDemoedPluginManifestPresent ?? true) {
    manifests[DEMOED_PLUGIN_ID] = strictProxy<PluginManifest>({ id: DEMOED_PLUGIN_ID, name: DEMOED_PLUGIN_NAME });
  }

  // Built as a variable rather than inline, so the desktop-only `getBasePath` can be attached without
  // Tripping the excess-property check against `DataAdapter`, which does not declare it.
  const adapterMembers: AdapterMembers = { exists: adapterExists, getBasePath: (options.hasVaultBasePath ?? true) ? (): string => VAULT_BASE_PATH : undefined, list: adapterList, mkdir: adapterMkdir, read: adapterRead, write: adapterWrite };

  const app = strictProxy<App>({
    plugins: strictProxy<App['plugins']>({
      disablePluginAndSave,
      enabledPlugins,
      enablePluginAndSave,
      installPlugin,
      manifests
    }),
    vault: strictProxy<Vault>({
      adapter: strictProxy<DataAdapter>(adapterMembers),
      // eslint-disable-next-line unicorn/name-replacements -- `configDir` is declared by `obsidian`; renaming it here would not match the API.
      configDir: `${EMPTY}.obsidian`
    })
  });

  return {
    adapterList,
    adapterMkdir,
    adapterWrite,
    app,
    disablePluginAndSave,
    enablePluginAndSave,
    installPlugin
  };
}

function getSandboxNoticeDuration(): number | undefined {
  return mockNotice.mock.calls.at(-1)?.[1];
}

function getSandboxNoticeText(): string {
  const message = mockNotice.mock.calls.at(-1)?.[0];
  if (message === undefined) {
    return EMPTY;
  }
  return typeof message === 'string' ? message : message.textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestUrl.mockImplementation((argument: RequestUrlParam | string) => {
    const url = typeof argument === 'string' ? argument : argument.url;
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

  it('should create the invocable scripts folder when it does not exist', async () => {
    const { adapterMkdir, app } = createApp();
    await bootstrapDemoVault({ app });
    expect(adapterMkdir).toHaveBeenCalledWith(INVOCABLE_SCRIPTS_FOLDER_PATH);
  });

  it('should not create the invocable scripts folder when it already exists', async () => {
    const { adapterMkdir, app } = createApp({ isInvocableScriptsFolderPresent: true });
    await bootstrapDemoVault({ app });
    expect(adapterMkdir).not.toHaveBeenCalled();
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

describe('bootstrapDemoVault sandbox notice', () => {
  it('should name the demonstrated plugin, the vault path, and the command that replaces the vault', async () => {
    const { app } = createApp();
    await bootstrapDemoVault({ app });
    const noticeText = getSandboxNoticeText();
    expect(noticeText).toContain(`This is a demo vault for ${DEMOED_PLUGIN_NAME}.`);
    expect(noticeText).toContain(`temporary sandbox at ${VAULT_BASE_PATH}`);
    expect(noticeText).toContain(`${DEMOED_PLUGIN_NAME}: Open demo vault`);
  });

  it('should stay until the user clicks it', async () => {
    const { app } = createApp();
    await bootstrapDemoVault({ app });
    expect(getSandboxNoticeDuration()).toBe(PERMANENT_NOTICE_DURATION_IN_MILLISECONDS);
  });

  // The vault is deleted about a day after its last use, so the notice must never suggest work can be
  // Left in it — see `cleanupOrphanedExtractedVaults` in `desktop-demo-vault-opener.ts`.
  it('should describe the vault as temporary rather than as somewhere work can be kept', async () => {
    const { app } = createApp();
    await bootstrapDemoVault({ app });
    const noticeText = getSandboxNoticeText();
    expect(noticeText).toContain('cleaned up automatically about a day after you last use it');
    expect(noticeText).toContain('copy anything you want to keep into your own vault');
  });

  it('should fall back to the plugin id when the demonstrated plugin has no manifest', async () => {
    const { app } = createApp({ isDemoedPluginManifestPresent: false });
    await bootstrapDemoVault({ app });
    expect(getSandboxNoticeText()).toContain(`This is a demo vault for ${DEMOED_PLUGIN_ID}.`);
  });

  it('should identify the demonstrated plugin before CodeScript Toolkit is installed', async () => {
    const { adapterList, app, installPlugin } = createApp();
    await bootstrapDemoVault({ app });
    const listOrder = vi.mocked(adapterList).mock.invocationCallOrder[0] ?? 0;
    const installOrder = vi.mocked(installPlugin).mock.invocationCallOrder[0] ?? 0;
    expect(listOrder).toBeLessThan(installOrder);
  });

  it('should stay generic when the vault holds no plugin besides the helper', async () => {
    const { app } = createApp({ pluginFolderIds: [HELPER_PLUGIN_ID] });
    await bootstrapDemoVault({ app });
    expect(getSandboxNoticeText()).toContain('This is a demo vault. It is a temporary sandbox');
    expect(getSandboxNoticeText()).toContain('Running Open demo vault again');
  });

  it('should stay generic when several plugins could be the demonstrated one', async () => {
    const { app } = createApp({ pluginFolderIds: [HELPER_PLUGIN_ID, DEMOED_PLUGIN_ID, 'another-plugin'] });
    await bootstrapDemoVault({ app });
    expect(getSandboxNoticeText()).toContain('This is a demo vault. It is');
  });

  it('should stay generic when there is no plugins folder to read', async () => {
    const { adapterList, app } = createApp({ isPluginsFolderPresent: false });
    await bootstrapDemoVault({ app });
    expect(adapterList).not.toHaveBeenCalled();
    expect(getSandboxNoticeText()).toContain('This is a demo vault. It is');
  });

  it('should omit the path when the adapter does not expose one', async () => {
    const { app } = createApp({ hasVaultBasePath: false });
    await bootstrapDemoVault({ app });
    const noticeText = getSandboxNoticeText();
    expect(noticeText).toContain('It is a temporary sandbox, cleaned up automatically');
    expect(noticeText).not.toContain(VAULT_BASE_PATH);
  });
});
