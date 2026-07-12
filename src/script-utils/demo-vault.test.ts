import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolvePathFromRootSafeParams } from './root.ts';

import { archivePluginDemoVault } from './demo-vault.ts';

const {
  mockAddLocalFolder,
  mockCp,
  mockExistsSync,
  mockMkdir,
  mockReadFile,
  mockResolvePathFromRootSafe,
  mockWriteZipPromise
} = vi.hoisted(() => ({
  mockAddLocalFolder: vi.fn(),
  mockCp: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
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
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockCp.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockReadFile.mockResolvedValue(JSON.stringify({ id: 'my-plugin' }));
  mockWriteZipPromise.mockResolvedValue(true);
});

describe('archivePluginDemoVault', () => {
  it('should return null and do nothing when demo-vault folder is absent', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await archivePluginDemoVault('1.2.3');
    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockCp).not.toHaveBeenCalled();
    expect(mockWriteZipPromise).not.toHaveBeenCalled();
  });

  it('should install the built plugin, zip the vault, and return the archive path', async () => {
    mockExistsSync.mockReturnValue(true);
    const result = await archivePluginDemoVault('1.2.3');

    expect(mockReadFile).toHaveBeenCalledWith('/root/manifest.json', 'utf-8');
    // eslint-disable-next-line obsidianmd/hardcoded-config-path -- Asserting the fixed skeleton layout of a shipped demo-vault archive, not a live-vault lookup.
    expect(mockMkdir).toHaveBeenCalledWith('/root/demo-vault/.obsidian/plugins/my-plugin', { recursive: true });
    // eslint-disable-next-line obsidianmd/hardcoded-config-path -- Asserting the fixed skeleton layout of a shipped demo-vault archive, not a live-vault lookup.
    expect(mockCp).toHaveBeenCalledWith('/root/dist/build', '/root/demo-vault/.obsidian/plugins/my-plugin', { recursive: true });
    expect(mockAddLocalFolder).toHaveBeenCalledWith('/root/demo-vault');
    expect(mockWriteZipPromise).toHaveBeenCalledWith('/root/dist/build/demo-vault-1.2.3.zip');
    expect(result).toBe('/root/dist/build/demo-vault-1.2.3.zip');
  });
});
