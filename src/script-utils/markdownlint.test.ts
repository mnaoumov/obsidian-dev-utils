import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolveToolCommandParams } from './package-manager.ts';
import type { ResolvePathFromRootSafeParams } from './root.ts';

import { noopAsync } from '../function.ts';
import { lint } from './linters/markdownlint.ts';

const {
  mockCp,
  mockExecFromRoot,
  mockExistsSync,
  mockGetNonIgnoredFiles,
  mockGetRootFolder,
  mockGlob,
  mockResolvePathFromRootSafe,
  mockResolveToolCommand
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockExecFromRoot: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetNonIgnoredFiles: vi.fn<() => Promise<null | string[]>>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockGlob: vi.fn(),
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

vi.mock('../script-utils/git.ts', () => ({
  getNonIgnoredFiles: mockGetNonIgnoredFiles
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
    glob: mockGlob
  };
});

vi.mock('../debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockExecFromRoot.mockResolvedValue('');
  mockCp.mockResolvedValue(undefined);
  // Default to "git cannot answer" so the existing cases keep exercising the glob fallback they assert on.
  mockGetNonIgnoredFiles.mockResolvedValue(null);
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockResolveToolCommand.mockImplementation((params: ResolveToolCommandParams) => [params.tool]);
  mockGlob.mockReturnValue((async function* generateMdFiles(): AsyncGenerator<string, void> {
    await noopAsync();
    yield 'README.md';
  })());
});

describe('lint', () => {
  it('should run markdownlint-cli2 and linkinator when config file exists', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledTimes(2);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['markdownlint-cli2', { batchedArguments: ['.'] }])
    );
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['linkinator', { batchedArguments: ['README.md'] }])
    );
  });

  it('should pass --fix when shouldFix is true', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint({ shouldFix: true });
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['markdownlint-cli2', '--fix', { batchedArguments: ['.'] }])
    );
  });

  it('should not pass --fix when shouldFix is false', async () => {
    mockExistsSync.mockReturnValue(true);
    await lint({ shouldFix: false });
    const firstCall = mockExecFromRoot.mock.calls[0] as string[][];
    expect(firstCall[0]).not.toContain('--fix');
  });

  it('should copy default config when no config file exists', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue('/pkg');
    await lint();
    expect(mockCp).toHaveBeenCalledTimes(1);
    expect(mockCp).toHaveBeenCalledWith(
      expect.stringMatching(/dist[\\/]templates[\\/]\.markdownlint-cli2\.mjs$/),
      '/root/.markdownlint-cli2.mjs'
    );
    expect(mockExecFromRoot).toHaveBeenCalledTimes(2);
  });

  it('should throw when package folder is not found', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetRootFolder.mockReturnValue(null);
    await expect(lint()).rejects.toThrow('Package folder not found');
  });

  it('should link-check the non-ignored markdown files git reports', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetNonIgnoredFiles.mockResolvedValue(['README.md', 'docs/guide.md']);
    await lint();
    expect(mockGetNonIgnoredFiles).toHaveBeenCalledWith({ patterns: ['*.md'] });
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['linkinator', { batchedArguments: ['README.md', 'docs/guide.md'] }])
    );
  });

  // Git only skips what the repository asked it to skip, and `obsidian-codescript-toolkit` deliberately
  // TRACKS a vendored `node_modules` tree so its demo vault can `require('uuid')` offline. Third-party
  // Markdown is not ours to link-check — the vendored README's relative link to an upstream-only file
  // Failed the whole gate.
  it('should drop vendored node_modules markdown from the list git reports', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetNonIgnoredFiles.mockResolvedValue([
      'README.md',
      'demo-vault/_assets/CodeScriptToolkit/node_modules/uuid/README.md',
      'docs/guide.md'
    ]);
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['linkinator', { batchedArguments: ['README.md', 'docs/guide.md'] }])
    );
  });

  it('should keep a file whose own name merely contains the words', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetNonIgnoredFiles.mockResolvedValue(['docs/node_modules-migration.md']);
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['linkinator', { batchedArguments: ['docs/node_modules-migration.md'] }])
    );
  });

  it('should prefer git over the glob fallback', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetNonIgnoredFiles.mockResolvedValue(['README.md']);
    await lint();
    expect(mockGlob).not.toHaveBeenCalled();
  });

  it('should fall back to the glob when git cannot answer', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetNonIgnoredFiles.mockResolvedValue(null);
    await lint();
    expect(mockGlob).toHaveBeenCalledOnce();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['linkinator', { batchedArguments: ['README.md'] }])
    );
  });

  it('should handle multiple markdown files from glob', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockReturnValue((async function* generateMultipleMdFiles(): AsyncGenerator<string, void> {
      await noopAsync();
      yield 'README.md';
      yield 'CHANGELOG.md';
      yield 'docs/guide.md';
    })());
    await lint();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      expect.arrayContaining(['linkinator', { batchedArguments: ['README.md', 'CHANGELOG.md', 'docs/guide.md'] }])
    );
  });
});
