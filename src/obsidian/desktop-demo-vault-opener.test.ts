// @vitest-environment jsdom

import type {
  App as AppOriginal,
  PluginManifest,
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

import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';
import type { OpenDemoVaultParams } from './desktop-demo-vault-opener.ts';
import type { SelectOptionParams } from './modals/select-option.ts';

import { join } from '../path.ts';
import { strictProxy } from '../strict-proxy.ts';
import { openDemoVault } from './desktop-demo-vault-opener.ts';

const {
  mockExistsSync,
  mockExtractAllTo,
  mockGetCommunityPluginRepo,
  mockRequestUrl,
  mockSelectOption,
  mockSendSync,
  mockShowNotice
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockExtractAllTo: vi.fn(),
  mockGetCommunityPluginRepo: vi.fn<(pluginId: string) => Promise<null | string>>(),
  mockRequestUrl: vi.fn(),
  mockSelectOption: vi.fn(),
  mockSendSync: vi.fn(),
  mockShowNotice: vi.fn()
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
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: mockExistsSync
    },
    existsSync: mockExistsSync
  };
});

vi.mock('adm-zip', () => ({
  default: class {
    public extractAllTo = mockExtractAllTo;
  }
}));

vi.mock('./community-plugins.ts', () => ({
  getCommunityPluginRepo: mockGetCommunityPluginRepo
}));

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
    manifest: strictProxy<PluginManifest>({
      id: PLUGIN_ID,
      name: 'My Plugin',
      version
    }),
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice: mockShowNotice })
  };
}

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_NOT_FOUND = 404;

function cacheDirSuffix(version: string): string {
  return join('obsidian-demo-vaults', PLUGIN_ID, version);
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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCommunityPluginRepo.mockResolvedValue(REPO);
  mockExistsSync.mockReturnValue(false);
  setLatestReleaseVersion(CURRENT_VERSION);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { sendSync: mockSendSync } }
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
});

describe('openDemoVault', () => {
  it('should open the current version directly when it is up to date', async () => {
    setLatestReleaseVersion(CURRENT_VERSION);
    await openDemoVault(buildParams());
    expect(mockSelectOption).not.toHaveBeenCalled();
    expect(mockSendSync).toHaveBeenCalledWith('vault-open', expect.stringContaining(cacheDirSuffix(CURRENT_VERSION)), false);
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
    expect(mockSendSync).toHaveBeenCalledWith('vault-open', expect.stringContaining(cacheDirSuffix('2.0.0')), false);
  });

  it('should open the current version when chosen from the dialog', async () => {
    setLatestReleaseVersion('2.0.0');
    mockSelectOption.mockResolvedValue(CURRENT_VERSION);
    await openDemoVault(buildParams());
    expect(mockSendSync).toHaveBeenCalledWith('vault-open', expect.stringContaining(cacheDirSuffix(CURRENT_VERSION)), false);
  });

  it('should do nothing when the version dialog is cancelled', async () => {
    setLatestReleaseVersion('2.0.0');
    mockSelectOption.mockResolvedValue(null);
    await openDemoVault(buildParams());
    expect(mockSendSync).not.toHaveBeenCalled();
    expect(mockExtractAllTo).not.toHaveBeenCalled();
  });

  it('should skip the download when the version is already cached', async () => {
    mockExistsSync.mockReturnValue(true);
    await openDemoVault(buildParams());
    expect(mockExtractAllTo).not.toHaveBeenCalled();
    expect(mockSendSync).toHaveBeenCalledWith('vault-open', expect.stringContaining(cacheDirSuffix(CURRENT_VERSION)), false);
  });

  it('should download and extract the archive when the version is not cached', async () => {
    await openDemoVault(buildParams());
    expect(mockExtractAllTo).toHaveBeenCalledWith(expect.stringContaining(cacheDirSuffix(CURRENT_VERSION)), true);
    expect(mockSendSync).toHaveBeenCalledWith('vault-open', expect.stringContaining(cacheDirSuffix(CURRENT_VERSION)), false);
  });

  it('should show a notice and not open when the archive is missing', async () => {
    setLatestReleaseVersion(CURRENT_VERSION, HTTP_STATUS_NOT_FOUND);
    await openDemoVault(buildParams());
    expect(mockShowNotice).toHaveBeenCalledWith(expect.stringContaining('No demo vault is available'));
    expect(mockSendSync).not.toHaveBeenCalled();
  });
});
