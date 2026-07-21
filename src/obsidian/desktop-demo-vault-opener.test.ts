// @vitest-environment jsdom

import type {
  App as AppOriginal,
  RequestUrlParam
} from 'obsidian';

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

import { basename } from '../path.ts';
import { strictProxy } from '../strict-proxy.ts';
// The opener loads Electron's `node:original-fs` via `window.require`.
// `beforeEach` stubs that global to return this `chmodSync` — the exact reference handed to adm-zip.
import { chmodSync as originalFsStubChmodSync } from '../test-helpers/original-fs-stub.ts';
import { openDemoVault } from './desktop-demo-vault-opener.ts';

interface AdmZipInitOptionsLike {
  readonly fs?: ExtractionFs;
}

interface ExtractionFolderStats {
  readonly mtimeMs: number;
}

interface ExtractionFs {
  chmodSync(path: string, mode: number): void;
}

const {
  mockAdmZipInit,
  mockExistsSync,
  mockExtractAllTo,
  mockGetCommunityPluginRepo,
  mockMkdirSync,
  mockMkdtempSync,
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
  mockAdmZipInit: vi.fn<(options?: AdmZipInitOptionsLike) => void>(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockExtractAllTo: vi.fn(),
  mockGetCommunityPluginRepo: vi.fn<(pluginId: string) => Promise<null | string>>(),
  mockMkdirSync: vi.fn(),
  mockMkdtempSync: vi.fn<(prefix: string) => string>(),
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

vi.mock('adm-zip', () => ({
  default: class {
    public extractAllTo = mockExtractAllTo;
    public constructor(_input: unknown, options?: AdmZipInitOptionsLike) {
      mockAdmZipInit(options);
    }
  }
}));

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

function archiveFileName(version: string): string {
  return `${PLUGIN_ID}-${version}.zip`;
}

function demoVaultFolderName(version: string): string {
  return `${PLUGIN_ID}-${version}.demo-vault`;
}

function getOpenedVaultDir(): string {
  const call = mockSendSync.mock.calls.at(-1);
  return call?.[1] as string;
}

function latestReleaseResponse(version: string): MockGitHubResponse {
  // eslint-disable-next-line camelcase -- The field name is dictated by the GitHub API JSON.
  return { json: { tag_name: version } };
}

function setLatestReleaseVersion(latestVersion: string, assetStatus = HTTP_STATUS_OK): void {
  mockRequestUrl.mockImplementation((arg: RequestUrlParam | string) => {
    const url = typeof arg === 'string' ? arg : arg.url;
    if (url.includes('releases/latest')) {
      return Promise.resolve(latestReleaseResponse(latestVersion));
    }
    return Promise.resolve({
      arrayBuffer: new ArrayBuffer(0),
      status: assetStatus
    });
  });
}

function wasAssetDownloaded(): boolean {
  return mockRequestUrl.mock.calls.some((call) => {
    const arg = call[0] as RequestUrlParam | string;
    const url = typeof arg === 'string' ? arg : arg.url;
    return url.includes('releases/download');
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCommunityPluginRepo.mockResolvedValue(REPO);
  mockExistsSync.mockReturnValue(false);
  mockReaddirSync.mockReturnValue([]);
  mockReadFileSync.mockReturnValue(Buffer.from('cached-archive'));
  // `mkdtempSync` appends a random suffix to its prefix; emulate a deterministic unique parent folder.
  mockMkdtempSync.mockImplementation((prefix: string) => `${prefix}abc123`);
  mockShowNoticeAfterDelay.mockReturnValue({
    setContent: mockSetContent,
    [Symbol.dispose]: vi.fn()
  });
  setLatestReleaseVersion(CURRENT_VERSION);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { sendSync: mockSendSync } }
  });
  Object.defineProperty(window, 'require', {
    configurable: true,
    value: (id: string): unknown => {
      if (id === 'node:original-fs') {
        return { chmodSync: originalFsStubChmodSync };
      }
      throw new Error(`Unexpected require of '${id}'`);
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
  });

  it('should open the current version directly when it is up to date', async () => {
    setLatestReleaseVersion(CURRENT_VERSION);
    await openDemoVault(buildParams());
    expect(mockSelectOption).not.toHaveBeenCalled();
    expect(basename(getOpenedVaultDir())).toBe(demoVaultFolderName(CURRENT_VERSION));
    expect(mockSendSync).toHaveBeenCalledWith('vault-open', expect.any(String), false);
  });

  it('should name the extracted vault folder <plugin-id>-<version>.demo-vault', async () => {
    await openDemoVault(buildParams());
    expect(basename(getOpenedVaultDir())).toBe(demoVaultFolderName(CURRENT_VERSION));
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
    expect(basename(getOpenedVaultDir())).toBe(demoVaultFolderName('2.0.0'));
  });

  it('should open the current version when chosen from the dialog', async () => {
    setLatestReleaseVersion('2.0.0');
    mockSelectOption.mockResolvedValue(CURRENT_VERSION);
    await openDemoVault(buildParams());
    expect(basename(getOpenedVaultDir())).toBe(demoVaultFolderName(CURRENT_VERSION));
  });

  it('should do nothing when the version dialog is cancelled', async () => {
    setLatestReleaseVersion('2.0.0');
    mockSelectOption.mockResolvedValue(null);
    await openDemoVault(buildParams());
    expect(mockSendSync).not.toHaveBeenCalled();
    expect(mockExtractAllTo).not.toHaveBeenCalled();
  });

  it('should download and cache the archive when it is not cached', async () => {
    await openDemoVault(buildParams());
    expect(mockRequestUrl).toHaveBeenCalledWith({
      throw: false,
      url: `https://github.com/${REPO}/releases/download/${CURRENT_VERSION}/${PLUGIN_ID}-demo-vault-${CURRENT_VERSION}.zip`
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(expect.stringContaining(archiveFileName(CURRENT_VERSION)), expect.any(Buffer));
    expect(mockExtractAllTo).toHaveBeenCalledTimes(1);
    expect(basename(getOpenedVaultDir())).toBe(demoVaultFolderName(CURRENT_VERSION));
  });

  it('should reuse the cached archive without re-downloading it', async () => {
    // The archive is cached; the extracted-vaults root is not (so cleanup is a no-op).
    mockExistsSync.mockImplementation((path: string) => path.includes(archiveFileName(CURRENT_VERSION)));
    await openDemoVault(buildParams());
    expect(wasAssetDownloaded()).toBe(false);
    expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining(archiveFileName(CURRENT_VERSION)));
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockExtractAllTo).toHaveBeenCalledTimes(1);
  });

  it('should extract into a fresh unique folder on every open (never reuse an extraction)', async () => {
    await openDemoVault(buildParams());
    await openDemoVault(buildParams());
    expect(mockMkdtempSync).toHaveBeenCalledTimes(2);
    expect(mockExtractAllTo).toHaveBeenCalledTimes(2);
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
    expect(basename(getOpenedVaultDir())).toBe(demoVaultFolderName(CURRENT_VERSION));
  });

  it('should hand adm-zip Electron original-fs so chmod-ing an extracted .asar file cannot crash', async () => {
    // Electron's asar layer intercepts fs operations on any path containing `.asar` and throws
    // ENOENT when chmod-ing an `.asar` file (it treats it as an archive root, not a plain file).
    // The demo vault ships `_assets/CodeScriptToolkit/module.asar`, so the opener must extract with
    // `original-fs` (asar interception disabled) rather than the intercepted `node:fs`.
    await openDemoVault(buildParams());
    const options = mockAdmZipInit.mock.calls.at(-1)?.[0];
    expect(options?.fs?.chmodSync).toBe(originalFsStubChmodSync);
  });

  it('should show a notice and not open when the archive is missing', async () => {
    setLatestReleaseVersion(CURRENT_VERSION, HTTP_STATUS_NOT_FOUND);
    await openDemoVault(buildParams());
    expect(mockShowNotice).toHaveBeenCalledWith(expect.stringContaining('No demo vault is available'));
    expect(mockSendSync).not.toHaveBeenCalled();
  });
});
