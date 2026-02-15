import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { format } from '../../src/ScriptUtils/format.ts';

const {
  mockExecFromRoot,
  mockExistsSync,
  mockGetRootFolder,
  mockResolvePathFromRootSafe
} = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockResolvePathFromRootSafe: vi.fn<(path: string, cwd?: string) => string>()
}));

vi.mock('../../src/ScriptUtils/Root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('../../src/ScriptUtils/NodeModules.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/ScriptUtils/NodeModules.ts')>();
  return {
    ...mod,
    existsSync: mockExistsSync
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockGetRootFolder.mockReturnValue('/root');
  mockResolvePathFromRootSafe.mockImplementation((path: string) => `/root/${path}`);
});

describe('format', () => {
  it('should throw when root folder is not found', async () => {
    mockGetRootFolder.mockReturnValue(null);
    await expect(format()).rejects.toThrow('Root folder not found');
  });

  it('should use local dprint.json when it exists', async () => {
    mockExistsSync.mockReturnValue(true);
    await format();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'dprint', 'fmt'])
    );
  });

  it('should run dprint check when rewrite is false', async () => {
    mockExistsSync.mockReturnValue(true);
    await format(false);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'dprint', 'check'])
    );
  });

  it('should throw when dprint.json is not found anywhere', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockImplementation((cwd?: string) => cwd ? '/pkg' : '/root');
    await expect(format()).rejects.toThrow('dprint.json not found');
  });

  it('should throw when package folder is not found', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockImplementation((cwd?: string) => cwd ? null : '/root');
    await expect(format()).rejects.toThrow('Could not find package folder');
  });

  it('should use fallback dprint.json from package folder', async () => {
    let callCount = 0;
    mockExistsSync.mockImplementation(() => {
      callCount++;
      return callCount !== 1;
    });
    mockGetRootFolder.mockImplementation((cwd?: string) => cwd ? '/pkg' : '/root');
    await format();
    expect(mockExecFromRoot).toHaveBeenCalledTimes(1);
  });
});
