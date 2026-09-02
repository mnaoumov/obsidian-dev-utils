// @vitest-environment jsdom

import type {
  App as AppOriginal,
  RequestUrlParam
} from 'obsidian';

import AdmZip from 'adm-zip';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type {
  PluginNoticeComponent,
  PluginNoticeComponentDelayedNotice,
  PluginNoticeComponentShowNoticeAfterDelayParams
} from './components/plugin-notice-component.ts';
import type { OpenDemoVaultParams } from './desktop-demo-vault-opener.ts';
import type { SelectOptionParams } from './modals/select-option.ts';

import {
  basename,
  dirname
} from '../path.ts';
import { strictProxy } from '../strict-proxy.ts';
import { PluginNoticeMode } from './components/plugin-notice-component.ts';
import { openDemoVault } from './desktop-demo-vault-opener.ts';

interface ExtractionFolderStats {
  readonly mtimeMs: number;
}

const {
  mockExistsSync,
  mockGetCommunityPluginRepo,
  mockMkdirSync,
  mockMkdtempSync,
  mockOriginalFsMkdirSync,
  mockOriginalFsWriteFileSync,
  mockReaddirSync,
  mockReadFileSync,
  mockRequestUrl,
  mockRmSync,
  mockSelectOption,
  mockSendSync,
  mockSetContent,
  mockShowNotice,
  mockShowNoticeAfterDelay,
  mockStatSync,
  mockWriteFileSync
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetCommunityPluginRepo: vi.fn<(pluginId: string) => Promise<null | string>>(),
  mockMkdirSync: vi.fn(),
  mockMkdtempSync: vi.fn<(prefix: string) => string>(),
  mockOriginalFsMkdirSync: vi.fn<(path: string) => undefined>(),
  mockOriginalFsWriteFileSync: vi.fn<(path: string, data: Buffer) => void>(),
  mockReaddirSync: vi.fn<(path: string) => string[]>(),
  mockReadFileSync: vi.fn<(path: string) => Buffer>(),
  mockRequestUrl: vi.fn(),
  mockRmSync: vi.fn(),
  mockSelectOption: vi.fn(),
  mockSendSync: vi.fn(),
  mockSetContent: vi.fn(),
  mockShowNotice: vi.fn(),
  mockShowNoticeAfterDelay: vi.fn<(params: PluginNoticeComponentShowNoticeAfterDelayParams) => PluginNoticeComponentDelayedNotice>(),
  mockStatSync: vi.fn<(path: string) => ExtractionFolderStats>(),
  mockWriteFileSync: vi.fn()
}));

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    requestUrl: mockRequestUrl
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const overrides = {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    mkdtempSync: mockMkdtempSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
    rmSync: mockRmSync,
    statSync: mockStatSync,
    writeFileSync: mockWriteFileSync
  };
  return {
    ...actual,
    ...overrides,
    default: {
      ...actual,
      ...overrides
    }
  };
});

vi.mock('./community-plugins.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./community-plugins.ts')>();
  return {
    ...actual,
    getCommunityPluginRepo: mockGetCommunityPluginRepo
  };
});

vi.mock('./modals/select-option.ts', () => ({
  selectOption: mockSelectOption
}));

interface MockGitHubResponse {
  json: unknown;
}

const PLUGIN_ID = 'my-plugin';
const REPO = 'owner/my-plugin';
const CURRENT_VERSION = '1.0.0';

function buildParams(version = CURRENT_VERSION): OpenDemoVaultParams {
  return {
    app: strictProxy<AppOriginal>({}),
    pluginId: PLUGIN_ID,
    pluginName: 'My Plugin',
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({
      showNotice: mockShowNotice,
      showNoticeAfterDelay: mockShowNoticeAfterDelay
    }),
    pluginVersion: version
  };
}

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_NOT_FOUND = 404;

const DEMO_VAULT_NOTE_PATH = 'Notes/Welcome.md';
const DEMO_VAULT_NOTE_CONTENT = '# Welcome to the demo vault';

// The release tag the asset URL is namespaced by — which is where the version lives now that the asset
// Name itself carries none.
const DOWNLOADED_VERSION_REG_EXP = /releases\/download\/(?<version>[^/]+)\//;

// The LOCAL cache name, which the opener derives from the version it resolved rather than from the asset
// Name — the reason dropping the version from the asset name costs the cache nothing.
function archiveFileName(version: string): string {
  return `${PLUGIN_ID}-${version}.zip`;
}

// A REAL archive, written by the same `adm-zip` the release path uses, so the opener runs the real
// Extractor end to end rather than a stand-in that could not fail the way extraction does. Its entries
// Sit under the same single top-level folder the release path writes.
function buildDemoVaultArchive(version: string): Buffer {
  const zip = new AdmZip();
  zip.addFile(`${demoVaultFolderName(version)}/${DEMO_VAULT_NOTE_PATH}`, Buffer.from(DEMO_VAULT_NOTE_CONTENT, 'utf-8'));
  return zip.toBuffer();
}

function demoVaultFolderName(version: string): string {
  return `${PLUGIN_ID}-demo-vault-${version}`;
}

function getOpenedVaultDirectory(): string {
  const call = mockSendSync.mock.calls.at(-1);
  return call?.[1] as string;
}

function latestReleaseResponse(version: string): MockGitHubResponse {
  // eslint-disable-next-line camelcase -- The field name is dictated by the GitHub API JSON.
  return { json: { tag_name: version } };
}

function setLatestReleaseVersion(latestVersion: string, assetStatus = HTTP_STATUS_OK): void {
  mockRequestUrl.mockImplementation((argument: RequestUrlParam | string) => {
    const url = typeof argument === 'string' ? argument : argument.url;
    if (url.includes('releases/latest')) {
      return Promise.resolve(latestReleaseResponse(latestVersion));
    }
    const downloadedVersion = DOWNLOADED_VERSION_REG_EXP.exec(url)?.groups?.['version'] ?? CURRENT_VERSION;
    return Promise.resolve({
      arrayBuffer: new Uint8Array(buildDemoVaultArchive(downloadedVersion)).buffer,
      status: assetStatus
    });
  });
}

function wasAssetDownloaded(): boolean {
  return mockRequestUrl.mock.calls.some((call) => {
    const argument = call[0] as RequestUrlParam | string;
    const url = typeof argument === 'string' ? argument : argument.url;
    return url.includes('releases/download');
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCommunityPluginRepo.mockResolvedValue(REPO);
  mockExistsSync.mockReturnValue(false);
  mockReaddirSync.mockReturnValue([]);
  mockReadFileSync.mockReturnValue(buildDemoVaultArchive(CURRENT_VERSION));
  // `mkdtempSync` appends a random suffix to its prefix; emulate a deterministic unique parent folder.
  mockMkdtempSync.mockImplementation((prefix: string) => `${prefix}abc123`);
  mockShowNoticeAfterDelay.mockReturnValue({
    setContent: mockSetContent,
    [Symbol.dispose]: vi.fn()
  });
  setLatestReleaseVersion(CURRENT_VERSION);
  Object.defineProperties(window, {
    electron: {
      configurable: true,
      value: { ipcRenderer: { sendSync: mockSendSync } }
    },
    require: {
      configurable: true,
      value: (id: string): unknown => {
        if (id === 'node:original-fs') {
          // Deliberately NOT the mocked `node:fs`: the assertions below distinguish the two, which is
          // The whole point of loading `original-fs` for extraction.
          return {
            mkdirSync: mockOriginalFsMkdirSync,
            writeFileSync: mockOriginalFsWriteFileSync
          };
        }
        throw new Error(`Unexpected require of '${id}'`);
      }
    }
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
  Reflect.deleteProperty(window, 'require');
});

describe('openDemoVault', () => {
  it('should show a progress notice immediately when invoked', async () => {
    await openDemoVault(buildParams());
    expect(mockShowNoticeAfterDelay).toHaveBeenCalledTimes(1);
    expect(mockShowNoticeAfterDelay.mock.calls[0]?.[0]?.delayInMilliseconds).toBe(0);
    // Kept out of the shared slot: this flow raises ordinary notices ("not in the registry", "no demo
    // Vault for this version") while the operation runs, and a slot notice would hide the progress one.
    expect(mockShowNoticeAfterDelay.mock.calls[0]?.[0]?.mode).toBe(PluginNoticeMode.Separate);
  });

  it('should open the current version directly when it is up to date', async () => {
    setLatestReleaseVersion(CURRENT_VERSION);
    await openDemoVault(buildParams());
    expect(mockSelectOption).not.toHaveBeenCalled();
    expect(basename(getOpenedVaultDirectory())).toBe(demoVaultFolderName(CURRENT_VERSION));
    expect(mockSendSync).toHaveBeenCalledWith('vault-open', expect.any(String), false);
  });

  it('should name the extracted vault folder <plugin-id>-<version>.demo-vault', async () => {
    await openDemoVault(buildParams());
    expect(basename(getOpenedVaultDirectory())).toBe(demoVaultFolderName(CURRENT_VERSION));
  });

  it('should show a notice and not open when the plugin is not in the registry', async () => {
    mockGetCommunityPluginRepo.mockResolvedValue(null);
    await openDemoVault(buildParams());
    expect(mockShowNotice).toHaveBeenCalledWith(expect.stringContaining('community plugins registry'));
    expect(mockSendSync).not.toHaveBeenCalled();
  });

  it('should offer the latest version and open it when chosen', async () => {
    setLatestReleaseVersion('2.0.0');
    mockSelectOption.mockResolvedValue('2.0.0');
    await openDemoVault(buildParams());
    expect(mockSelectOption).toHaveBeenCalledTimes(1);
    const selectOptionParams = mockSelectOption.mock.calls[0]?.[0] as SelectOptionParams<null | string>;
    expect(selectOptionParams.options.map((option) => option.text)).toStrictEqual([
      'Open demo vault for latest version (v2.0.0)',
      'Open demo vault for current version (v1.0.0)',
      'Cancel'
    ]);
    expect(basename(getOpenedVaultDirectory())).toBe(demoVaultFolderName('2.0.0'));
  });

  it('should open the current version when chosen from the dialog', async () => {
    setLatestReleaseVersion('2.0.0');
    mockSelectOption.mockResolvedValue(CURRENT_VERSION);
    await openDemoVault(buildParams());
    expect(basename(getOpenedVaultDirectory())).toBe(demoVaultFolderName(CURRENT_VERSION));
  });

  it('should do nothing when the version dialog is cancelled', async () => {
    setLatestReleaseVersion('2.0.0');
    mockSelectOption.mockResolvedValue(null);
    await openDemoVault(buildParams());
    expect(mockSendSync).not.toHaveBeenCalled();
    expect(mockOriginalFsWriteFileSync).not.toHaveBeenCalled();
  });

  // The asset name carries no version: the release tag in the URL already namespaces it, and a name that
  // Changed every release is what broke the Community directory's finding overrides.
  it('should download and cache the archive when it is not cached', async () => {
    await openDemoVault(buildParams());
    expect(mockRequestUrl).toHaveBeenCalledWith({
      throw: false,
      url: `https://github.com/${REPO}/releases/download/${CURRENT_VERSION}/${PLUGIN_ID}-demo-vault.zip`
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(expect.stringContaining(archiveFileName(CURRENT_VERSION)), expect.any(Buffer));
    expect(mockOriginalFsWriteFileSync).toHaveBeenCalledTimes(1);
    expect(basename(getOpenedVaultDirectory())).toBe(demoVaultFolderName(CURRENT_VERSION));
  });

  it('should reuse the cached archive without re-downloading it', async () => {
    // The archive is cached; the extracted-vaults root is not (so cleanup is a no-op).
    mockExistsSync.mockImplementation((path: string) => path.includes(archiveFileName(CURRENT_VERSION)));
    await openDemoVault(buildParams());
    expect(wasAssetDownloaded()).toBe(false);
    expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining(archiveFileName(CURRENT_VERSION)));
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockOriginalFsWriteFileSync).toHaveBeenCalledTimes(1);
  });

  it('should extract into a fresh unique folder on every open (never reuse an extraction)', async () => {
    await openDemoVault(buildParams());
    await openDemoVault(buildParams());
    expect(mockMkdtempSync).toHaveBeenCalledTimes(2);
    expect(mockOriginalFsWriteFileSync).toHaveBeenCalledTimes(2);
  });

  it('should remove orphaned extracted vaults older than the max age', async () => {
    // The extracted-vaults root exists and holds a stale folder plus a recent one.
    mockExistsSync.mockImplementation((path: string) => path.includes('extracted'));
    mockReaddirSync.mockReturnValue(['stale-vault', 'recent-vault']);
    const now = Date.now();
    const twoDaysInMilliseconds = 2 * 24 * 60 * 60 * 1000;
    mockStatSync.mockImplementation((path: string) => ({
      mtimeMs: path.includes('stale-vault') ? now - twoDaysInMilliseconds : now
    }));
    await openDemoVault(buildParams());
    expect(mockRmSync).toHaveBeenCalledTimes(1);
    expect(mockRmSync).toHaveBeenCalledWith(expect.stringContaining('stale-vault'), expect.objectContaining({ recursive: true }));
  });

  it('should still open the vault when an orphaned folder cannot be removed', async () => {
    // A vault open in another window is locked on Windows; `rmSync` throws. Cleanup must swallow it.
    mockExistsSync.mockImplementation((path: string) => path.includes('extracted'));
    mockReaddirSync.mockReturnValue(['locked-vault']);
    mockStatSync.mockReturnValue({ mtimeMs: 0 });
    mockRmSync.mockImplementation(() => {
      throw new Error('EBUSY');
    });
    await openDemoVault(buildParams());
    expect(basename(getOpenedVaultDirectory())).toBe(demoVaultFolderName(CURRENT_VERSION));
  });

  it('should write the extracted vault with Electron original-fs, not the asar-intercepted node:fs', async () => {
    // Electron's asar layer intercepts fs operations on any path containing `.asar`, treating it as an
    // Archive root rather than a plain file. A demo vault may ship exactly such a file
    // (`_assets/CodeScriptToolkit/module.asar`), so extraction goes through `original-fs`.
    await openDemoVault(buildParams());
    const vaultDirectory = getOpenedVaultDirectory();

    expect(mockOriginalFsWriteFileSync).toHaveBeenCalledWith(`${vaultDirectory}/${DEMO_VAULT_NOTE_PATH}`, expect.anything());
    expect(mockWriteFileSync).not.toHaveBeenCalledWith(expect.stringContaining(demoVaultFolderName(CURRENT_VERSION)), expect.anything());
  });

  it('should extract the archive contents into the fresh vault folder', async () => {
    await openDemoVault(buildParams());
    const vaultDirectory = getOpenedVaultDirectory();
    const writtenContent = mockOriginalFsWriteFileSync.mock.calls.at(-1)?.[1];

    expect(mockOriginalFsMkdirSync).toHaveBeenCalledWith(`${vaultDirectory}/Notes`, { recursive: true });
    expect(writtenContent?.toString('utf-8')).toBe(DEMO_VAULT_NOTE_CONTENT);
  });

  // The archive holds the vault under one top-level folder, so extraction targets the unique PARENT and
  // The vault is that folder inside it. The name is known on both sides rather than searched for, which is
  // What keeps extraction free of any filesystem read (Electron's asar layer intercepts reads on any path
  // Containing `.asar`, which a demo vault may legitimately ship).
  it('should open the archive own top-level folder, not the folder it extracted into', async () => {
    await openDemoVault(buildParams());
    const vaultDirectory = getOpenedVaultDirectory();

    expect(basename(vaultDirectory)).toBe(demoVaultFolderName(CURRENT_VERSION));
    // `extractZipArchive` creates its target directory first, so this is the directory it extracted into.
    expect(mockOriginalFsMkdirSync).toHaveBeenCalledWith(dirname(vaultDirectory), { recursive: true });
  });

  it('should show a notice and not open when the archive is missing', async () => {
    setLatestReleaseVersion(CURRENT_VERSION, HTTP_STATUS_NOT_FOUND);
    await openDemoVault(buildParams());
    expect(mockShowNotice).toHaveBeenCalledWith(expect.stringContaining('No demo vault is available'));
    expect(mockSendSync).not.toHaveBeenCalled();
  });
});
