import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolveToolCommandParams } from './package-manager.ts';
import type { ResolvePathFromRootSafeParams } from './root.ts';

import { format } from './formatters/dprint.ts';

const {
  mockExecFromRoot,
  mockExistsSync,
  mockGetRootFolder,
  mockResolvePathFromRootSafe,
  mockResolveToolCommand
} = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockResolveToolCommand: vi.fn<(params: ResolveToolCommandParams) => string[]>()
}));

vi.mock('../script-utils/root.ts', () => ({
  execFromRoot: mockExecFromRoot,
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

vi.mock('../script-utils/package-manager.ts', () => ({
  resolveToolCommand: mockResolveToolCommand
}));

vi.mock('node:fs', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs')>();
  return {
    ...$module,
    existsSync: mockExistsSync
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockGetRootFolder.mockReturnValue('/root');
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockResolveToolCommand.mockImplementation((params: ResolveToolCommandParams) => [params.tool]);
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
      expect.arrayContaining(['dprint', 'fmt'])
    );
  });

  it('should run dprint check when rewrite is false', async () => {
    mockExistsSync.mockReturnValue(true);
    await format({ rewrite: false });
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['dprint', 'check'])
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
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['--config', expect.stringMatching(/dist[\\/]templates[\\/]dprint\.json$/)])
    );
  });
});
