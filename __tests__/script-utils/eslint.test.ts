import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { lint } from '../../src/script-utils/linters/eslint/eslint.ts';

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
  mockResolvePathFromRootSafe: vi.fn<(path: string) => string>()
}));

vi.mock('../../src/script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('../../src/script-utils/node-modules.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/script-utils/node-modules.ts')>();
  return {
    ...mod,
    cp: mockCp,
    existsSync: mockExistsSync
  };
});

vi.mock('../../src/debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockCp.mockResolvedValue(undefined);
  mockResolvePathFromRootSafe.mockImplementation((path: string) => `/root/${path}`);
});

describe('lint', () => {
  it('should run eslint when config file exists', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'eslint', '.'])
    );
    expect(mockCp).not.toHaveBeenCalled();
  });

  it('should pass --fix when shouldFix is true', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint(true);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'eslint', '--fix', '.'])
    );
  });

  it('should not pass --fix when shouldFix is false', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint(false);
    const call = mockExecFromRoot.mock.calls[0] as string[][];
    expect(call[0]).not.toContain('--fix');
  });

  it('should copy default config when no config file exists', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue('/pkg');
    await lint();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockExecFromRoot).toHaveBeenCalledTimes(1);
  });

  it('should throw when package folder is not found', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue(null);
    await expect(lint()).rejects.toThrow('Package folder not found');
  });
});
