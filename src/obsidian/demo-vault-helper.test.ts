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
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { EMPTY } from '../string.ts';
import { bootstrapDemoVault } from './demo-vault-helper.ts';

const CST_PLUGIN_ID = 'fix-require-modules';
const CST_REPO = 'mnaoumov/obsidian-codescript-toolkit';
const CST_VERSION = '1.0.0';

const HELPER_PLUGIN_ID = 'demo-vault-helper';
const DEMOED_PLUGIN_ID = 'my-plugin';
const DEMOED_PLUGIN_NAME = 'My Plugin';
const PERMANENT_NOTICE_DURATION_IN_MILLISECONDS = 0;
const INVALID_DEMO_VAULT_ERROR_MESSAGE = 'Invalid demo vault';

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
// The helper's own `data.json`, written by the packaging step: the vault's only statement of which
// Plugin it demonstrates.
const HELPER_SETTINGS_PATH = `${PLUGINS_FOLDER_PATH}/${HELPER_PLUGIN_ID}/data.json`;
const HELPER_SETTINGS_JSON = JSON.stringify({ demoedPluginId: DEMOED_PLUGIN_ID });
const INVOCABLE_SCRIPTS_FOLDER_PATH = `${CST_SETTINGS.modulesRoot}/${CST_SETTINGS.invocableScriptsFolder}`;

interface AdapterMembers {
  exists: DataAdapter['exists'];
  mkdir: DataAdapter['mkdir'];
  read: DataAdapter['read'];
  write: DataAdapter['write'];
}

interface AppMock {
  readonly adapterMkdir: DataAdapter['mkdir'];
  readonly adapterWrite: DataAdapter['write'];
  readonly app: App;
  readonly disablePluginAndSave: App['plugins']['disablePluginAndSave'];
  readonly enablePluginAndSave: App['plugins']['enablePluginAndSave'];
  readonly installPlugin: App['plugins']['installPlugin'];
  readonly settingClose: App['setting']['close'];
}

interface CreateAppOptions {
  readonly existingData?: string;
  // The content of the helper's `data.json`: `null` for a vault that has none at all, a string to hand
  // Over exactly what the bootstrap will read. Omitted means a well-formed marker.
  readonly helperSettingsJson?: null | string;
  readonly isCstEnabled?: boolean;
  readonly isCstInstalled?: boolean;
  readonly isDemoedPluginManifestPresent?: boolean;
  readonly isInvocableScriptsFolderPresent?: boolean;
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

  const helperSettingsJson = options.helperSettingsJson === undefined ? HELPER_SETTINGS_JSON : options.helperSettingsJson;

  const adapterExists = vi.fn<DataAdapter['exists']>().mockImplementation((path: string) => {
    switch (path) {
      case HELPER_SETTINGS_PATH: {
        return Promise.resolve(helperSettingsJson !== null);
      }
      case INVOCABLE_SCRIPTS_FOLDER_PATH: {
        return Promise.resolve(options.isInvocableScriptsFolderPresent ?? false);
      }
      default: {
        return Promise.resolve(options.existingData !== undefined);
      }
    }
  });
  const adapterRead = vi.fn<DataAdapter['read']>().mockImplementation((path: string) => Promise.resolve(path === HELPER_SETTINGS_PATH ? helperSettingsJson ?? EMPTY : options.existingData ?? '{}'));
  const adapterWrite = vi.fn<DataAdapter['write']>().mockResolvedValue();
  const adapterMkdir = vi.fn<DataAdapter['mkdir']>().mockResolvedValue();

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

  // Empty, with the same null-prototype treatment as `manifests`: the bootstrap configures CodeScript
  // Toolkit BEFORE enabling it, so it is never running at that point and the `data.json` path is taken.
  const plugins = castTo<App['plugins']['plugins']>({});
  Object.setPrototypeOf(plugins, null);

  const adapterMembers: AdapterMembers = { exists: adapterExists, mkdir: adapterMkdir, read: adapterRead, write: adapterWrite };

  const settingClose = vi.fn<App['setting']['close']>();

  const app = strictProxy<App>({
    plugins: strictProxy<App['plugins']>({
      disablePluginAndSave,
      enabledPlugins,
      enablePluginAndSave,
      installPlugin,
      manifests,
      plugins
    }),
    setting: strictProxy<App['setting']>({ close: settingClose }),
    vault: strictProxy<Vault>({
      adapter: strictProxy<DataAdapter>(adapterMembers),
      // eslint-disable-next-line unicorn/name-replacements -- `configDir` is declared by `obsidian`; renaming it here would not match the API.
      configDir: `${EMPTY}.obsidian`
    })
  });

  return {
    adapterMkdir,
    adapterWrite,
    app,
    disablePluginAndSave,
    enablePluginAndSave,
    installPlugin,
    settingClose
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
  it('should name the demonstrated plugin and the command that replaces the vault', async () => {
    const { app } = createApp();
    await bootstrapDemoVault({ app });
    const noticeText = getSandboxNoticeText();
    expect(noticeText).toContain(`This is a demo vault for ${DEMOED_PLUGIN_NAME}.`);
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
    expect(noticeText).toContain('It is a temporary sandbox, cleaned up automatically about a day after you last use it.');
    expect(noticeText).toContain('so your notes will not appear in it');
  });

  it('should fall back to the plugin id when the demonstrated plugin has no manifest', async () => {
    const { app } = createApp({ isDemoedPluginManifestPresent: false });
    await bootstrapDemoVault({ app });
    expect(getSandboxNoticeText()).toContain(`This is a demo vault for ${DEMOED_PLUGIN_ID}.`);
  });

  // The demonstrated plugin comes from the marker the packaging step wrote, so it survives everything
  // The bootstrap itself installs — including CodeScript Toolkit, and anything a demo note's
  // Prerequisites add — which counting plugin folders would not.
  it('should name the plugin from the marker even once other plugins are installed', async () => {
    const { app } = createApp({ isCstEnabled: true, isCstInstalled: true });
    await bootstrapDemoVault({ app });
    expect(getSandboxNoticeText()).toContain(`This is a demo vault for ${DEMOED_PLUGIN_NAME}.`);
  });

  // A vault carrying no readable marker was not produced by the packaging step, so there is no honest
  // Answer to "which plugin is this demonstrating?" — the bootstrap refuses it rather than guessing.
  it('should refuse a vault with no marker', async () => {
    const { app } = createApp({ helperSettingsJson: null });
    await expect(bootstrapDemoVault({ app })).rejects.toThrow(INVALID_DEMO_VAULT_ERROR_MESSAGE);
  });

  it('should refuse a vault whose marker is not valid JSON', async () => {
    const { app } = createApp({ helperSettingsJson: '{ not json' });
    await expect(bootstrapDemoVault({ app })).rejects.toThrow(INVALID_DEMO_VAULT_ERROR_MESSAGE);
  });

  it('should refuse a vault whose marker names no plugin', async () => {
    const { app } = createApp({ helperSettingsJson: JSON.stringify({ somethingElse: true }) });
    await expect(bootstrapDemoVault({ app })).rejects.toThrow(INVALID_DEMO_VAULT_ERROR_MESSAGE);
  });

  it('should refuse a vault whose marker names an empty plugin id', async () => {
    const { app } = createApp({ helperSettingsJson: JSON.stringify({ demoedPluginId: EMPTY }) });
    await expect(bootstrapDemoVault({ app })).rejects.toThrow(INVALID_DEMO_VAULT_ERROR_MESSAGE);
  });

  // The marker is read first, so a refused vault is left exactly as it was found: nothing installed,
  // Nothing configured, no notice.
  it('should touch nothing when it refuses the vault', async () => {
    const { adapterWrite, app, enablePluginAndSave, installPlugin } = createApp({ helperSettingsJson: null });
    await expect(bootstrapDemoVault({ app })).rejects.toThrow(INVALID_DEMO_VAULT_ERROR_MESSAGE);
    expect(installPlugin).not.toHaveBeenCalled();
    expect(adapterWrite).not.toHaveBeenCalled();
    expect(enablePluginAndSave).not.toHaveBeenCalled();
    expect(mockNotice).not.toHaveBeenCalled();
  });

  // Obsidian opens Settings in a POPOUT WINDOW that becomes the active one, and a `Notice` is built in
  // Whatever window is active — so a notice raised while Settings is open would be created inside the
  // Settings window and disappear with it, taking the description of the vault with it.
  it('should close the settings window before raising the notice', async () => {
    const { app, settingClose } = createApp();
    await bootstrapDemoVault({ app });
    expect(settingClose).toHaveBeenCalled();
    const closeOrder = vi.mocked(settingClose).mock.invocationCallOrder[0] ?? 0;
    const noticeOrder = mockNotice.mock.invocationCallOrder[0] ?? 0;
    expect(closeOrder).toBeLessThan(noticeOrder);
  });
});
