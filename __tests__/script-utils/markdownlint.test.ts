import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { lint } from '../../src/script-utils/linters/markdownlint.ts';

const {
  mockCp,
  mockExecFromRoot,
  mockExistsSync,
  mockGetRootFolder,
  mockGlob,
  mockResolvePathFromRootSafe
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockGlob: vi.fn(),
  mockResolvePathFromRootSafe: vi.fn<(path: string) => string>()
}));

vi.mock('../../src/script-utils/root.ts', () => ({
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
    cp: mockCp,
    glob: mockGlob
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
  mockGlob.mockReturnValue((async function* generateMdFiles(): AsyncGenerator<string, void> {
    yield 'README.md';
  })());
});

describe('lint', () => {
  it('should run markdownlint-cli2 and linkinator when config file exists', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledTimes(2);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'markdownlint-cli2', '.'])
    );
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'linkinator', 'README.md'])
    );
  });

  it('should pass --fix when shouldFix is true', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint(true);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'markdownlint-cli2', '--fix', '.'])
    );
  });

  it('should not pass --fix when shouldFix is false', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint(false);
    const firstCall = mockExecFromRoot.mock.calls[0] as string[][];
    expect(firstCall[0]).not.toContain('--fix');
  });

  it('should copy default configs when no config file exists', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue('/pkg');
    await lint();
    expect(mockCp).toHaveBeenCalledTimes(2);
    expect(mockExecFromRoot).toHaveBeenCalledTimes(2);
  });

  it('should throw when package folder is not found', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue(null);
    await expect(lint()).rejects.toThrow('Package folder not found');
  });

  it('should handle multiple markdown files from glob', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockReturnValue((async function* generateMultipleMdFiles(): AsyncGenerator<string, void> {
      yield 'README.md';
      yield 'CHANGELOG.md';
      yield 'docs/guide.md';
    })());
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['npx', 'linkinator', 'README.md', 'CHANGELOG.md', 'docs/guide.md'])
    );
  });
});
