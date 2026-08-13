import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolvePathFromRootSafeParams } from './root.ts';

import { EMPTY } from '../string.ts';
import { archivePluginDemoVault } from './demo-vault.ts';

const {
  mockAddFile,
  mockAddLocalFolder,
  mockCp,
  mockExistsSync,
  mockGetEntry,
  mockGetRootFolder,
  mockMkdir,
  mockReadFile,
  mockResolvePathFromRootSafe,
  mockUpdateFile,
  mockWriteFile,
  mockWriteZipPromise
} = vi.hoisted(() => ({
  mockAddFile: vi.fn(),
  mockAddLocalFolder: vi.fn(),
  mockCp: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetEntry: vi.fn<(entryName: string) => null | object>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn<(path: string, encoding: string) => Promise<string>>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockUpdateFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockWriteZipPromise: vi.fn()
}));

vi.mock('adm-zip', () => ({
  default: class {
    public addFile = mockAddFile;
    public addLocalFolder = mockAddLocalFolder;
    public getEntry = mockGetEntry;
    public updateFile = mockUpdateFile;
    public writeZipPromise = mockWriteZipPromise;
  }
}));

vi.mock('node:fs', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs')>();
  return {
    ...$module,
    existsSync: mockExistsSync
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...$module,
    cp: mockCp,
    mkdir: mockMkdir,
    readFile: mockReadFile,
    writeFile: mockWriteFile
  };
});

vi.mock('./root.ts', () => ({
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

const MANIFEST_PATH = '/root/manifest.json';
const APP_JSON_PATH = `/root/demo-vault/${EMPTY}.obsidian/app.json`;
const APP_JSON_ENTRY_NAME = `${EMPTY}.obsidian/app.json`;
const INJECTED_APP_JSON_SETTINGS = {
  defaultViewMode: 'preview',
  livePreview: false,
  newLinkFormat: 'relative',
  useMarkdownLinks: true
};

// The vault's own settings, carrying none of the ones this package injects — the state the demo-vault
// Coverage suite enforces on every consumer.
let committedAppJson: string;

function readInjectedAppJson(content: Buffer): unknown {
  return JSON.parse(content.toString('utf-8'));
}

beforeEach(() => {
  vi.resetAllMocks();
  committedAppJson = JSON.stringify({ attachmentFolderPath: '_assets' });
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockGetRootFolder.mockReturnValue('/package');
  mockCp.mockResolvedValue(undefined);
  mockGetEntry.mockReturnValue({});
  mockMkdir.mockResolvedValue(undefined);
  mockReadFile.mockImplementation((path: string) => Promise.resolve(path === MANIFEST_PATH ? JSON.stringify({ id: 'my-plugin', version: '1.2.3' }) : committedAppJson));
  mockWriteFile.mockResolvedValue(undefined);
  mockWriteZipPromise.mockResolvedValue(true);
});

describe('archivePluginDemoVault', () => {
  it('should return null and do nothing when demo-vault folder is absent', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await archivePluginDemoVault();
    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockCp).not.toHaveBeenCalled();
    expect(mockWriteZipPromise).not.toHaveBeenCalled();
  });

  it('should install the built plugin, zip the vault, and return the archive path', async () => {
    mockExistsSync.mockReturnValue(true);
    const result = await archivePluginDemoVault();

    expect(mockReadFile).toHaveBeenCalledWith('/root/manifest.json', 'utf-8');
    expect(mockMkdir).toHaveBeenCalledWith(`/root/demo-vault/${EMPTY}.obsidian/plugins/my-plugin`, { recursive: true });
    expect(mockCp).toHaveBeenCalledWith('/root/dist/build', `/root/demo-vault/${EMPTY}.obsidian/plugins/my-plugin`, { recursive: true });
    expect(mockAddLocalFolder).toHaveBeenCalledWith('/root/demo-vault');
    expect(mockWriteZipPromise).toHaveBeenCalledWith('/root/dist/build/my-plugin-demo-vault-1.2.3.zip');
    expect(result).toBe('/root/dist/build/my-plugin-demo-vault-1.2.3.zip');
  });

  it('should inject the shipped demo-vault-helper plugin into the vault', async () => {
    mockExistsSync.mockReturnValue(true);
    await archivePluginDemoVault();

    expect(mockMkdir).toHaveBeenCalledWith(`/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper`, { recursive: true });
    expect(mockCp).toHaveBeenCalledWith('/package/dist/demo-vault-helper', `/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper`, { recursive: true });
  });

  // The one moment the demonstrated plugin's id is known for certain — it comes from that plugin's own
  // Manifest. The opened vault can only offer plugin folders to count, and the bootstrap adds to those
  // Itself, so it reads this marker instead of guessing.
  it('should record the demonstrated plugin id in the helper settings', async () => {
    mockExistsSync.mockReturnValue(true);
    await archivePluginDemoVault();

    expect(mockWriteFile).toHaveBeenCalledWith(
      `/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper/data.json`,
      `${JSON.stringify({ demoedPluginId: 'my-plugin' }, null, 2)}\n`,
      'utf-8'
    );
  });

  // The settings belong to this package, so the archived copy carries them whatever the vault committed —
  // But the repo folder is never written to: `updateVersion` archives after it has already pushed, and
  // `app.json` is a tracked file, so an in-place write would leave a change behind a published release.
  it('should write the owned app.json settings into the archived vault, not into the repo folder', async () => {
    mockExistsSync.mockReturnValue(true);
    await archivePluginDemoVault();

    expect(mockUpdateFile).toHaveBeenCalledTimes(1);
    const [entry, content] = mockUpdateFile.mock.calls[0] as [object, Buffer];
    expect(entry).toEqual({});
    expect(readInjectedAppJson(content)).toEqual({
      ...INJECTED_APP_JSON_SETTINGS,
      attachmentFolderPath: '_assets'
    });
    expect(mockAddFile).not.toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalledWith(APP_JSON_PATH, expect.anything(), expect.anything());
  });

  it('should add an app.json to a vault that commits none', async () => {
    mockExistsSync.mockImplementation((path: string) => path !== APP_JSON_PATH);
    mockGetEntry.mockReturnValue(null);
    await archivePluginDemoVault();

    expect(mockReadFile).not.toHaveBeenCalledWith(APP_JSON_PATH, 'utf-8');
    expect(mockUpdateFile).not.toHaveBeenCalled();
    expect(mockAddFile).toHaveBeenCalledTimes(1);
    const [entryName, content] = mockAddFile.mock.calls[0] as [string, Buffer];
    expect(entryName).toBe(APP_JSON_ENTRY_NAME);
    expect(readInjectedAppJson(content)).toEqual(INJECTED_APP_JSON_SETTINGS);
  });

  // Reaching here means the coverage suite that already forbids this was skipped, so the committed value
  // Is refused rather than silently discarded.
  it('should throw when the committed app.json sets an owned setting', async () => {
    mockExistsSync.mockReturnValue(true);
    committedAppJson = JSON.stringify({ livePreview: true, newLinkFormat: 'absolute' });

    await expect(archivePluginDemoVault()).rejects.toThrow(
      `${APP_JSON_PATH} sets livePreview, newLinkFormat, which obsidian-dev-utils owns and writes into the archived demo vault. Settings it owns must not be committed.`
    );
    expect(mockWriteZipPromise).not.toHaveBeenCalled();
  });

  it('should throw when the committed app.json cannot be parsed', async () => {
    mockExistsSync.mockReturnValue(true);
    committedAppJson = '{ not json';

    await expect(archivePluginDemoVault()).rejects.toThrow(`Could not parse ${APP_JSON_PATH}.`);
  });

  it('should throw when the obsidian-dev-utils package folder cannot be resolved', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetRootFolder.mockReturnValue(null);
    await expect(archivePluginDemoVault())
      .rejects.toThrow('Could not resolve the obsidian-dev-utils package folder to inject the demo-vault-helper plugin.');
  });
});
