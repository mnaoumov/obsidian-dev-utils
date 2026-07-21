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
  mockAddLocalFolder,
  mockCp,
  mockExistsSync,
  mockGetRootFolder,
  mockMkdir,
  mockReadFile,
  mockResolvePathFromRootSafe,
  mockWriteZipPromise
} = vi.hoisted(() => ({
  mockAddLocalFolder: vi.fn(),
  mockCp: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockWriteZipPromise: vi.fn()
}));

vi.mock('adm-zip', () => ({
  default: class {
    public addLocalFolder = mockAddLocalFolder;
    public writeZipPromise = mockWriteZipPromise;
  }
}));

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>();
  return {
    ...mod,
    existsSync: mockExistsSync
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...mod,
    cp: mockCp,
    mkdir: mockMkdir,
    readFile: mockReadFile
  };
});

vi.mock('./root.ts', () => ({
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockGetRootFolder.mockReturnValue('/package');
  mockCp.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockReadFile.mockResolvedValue(JSON.stringify({ id: 'my-plugin', version: '1.2.3' }));
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

  it('should throw when the obsidian-dev-utils package folder cannot be resolved', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetRootFolder.mockReturnValue(null);
    await expect(archivePluginDemoVault())
      .rejects.toThrow('Could not resolve the obsidian-dev-utils package folder to inject the demo-vault-helper plugin.');
  });
});
