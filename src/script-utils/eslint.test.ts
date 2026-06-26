import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolvePathFromRootSafeParams } from './root.ts';

import { lint } from './linters/eslint.ts';

const {
  mockCp,
  mockExecFromRoot,
  mockExistsSync,
  mockGetRootFolder,
  mockResolvePathFromRootSafe
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
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
    cp: mockCp
  };
});

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockCp.mockResolvedValue(undefined);
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
});

describe('lint', () => {
  it('should run eslint when config file exists', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'eslint', { batchedArgs: ['.'] }])
    );
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should pass --fix when shouldFix is true', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint({ shouldFix: true });
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'eslint', '--fix', { batchedArgs: ['.'] }])
    );
  });

  it('should not pass --fix when shouldFix is false', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint({ shouldFix: false });
    const call = mockExecFromRoot.mock.calls[0] as string[][];
    expect(call[0]).not.toContain('--fix');
  });

  it('should copy default config when no config file exists', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue('/pkg');
    await lint();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      expect.stringMatching(/dist[\\/]templates[\\/]eslint\.config\.mts$/),
      '/root/eslint.config.mts'
    );
    expect(mockExecFromRoot).toHaveBeenCalledTimes(1);
  });

  it('should throw when package folder is not found', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue(null);
    await expect(lint()).rejects.toThrow('Package folder not found');
  });
});
