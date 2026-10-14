import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { getNonIgnoredFiles } from './git.ts';

const { mockExecFromRoot } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn<(command: unknown, options?: unknown) => Promise<string>>()
}));

vi.mock('./root.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('./root.ts')>(),
  execFromRoot: mockExecFromRoot
}));

describe('getNonIgnoredFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ask git for tracked and untracked-but-not-ignored files', async () => {
    mockExecFromRoot.mockResolvedValue('');
    await getNonIgnoredFiles();
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { isQuiet: true }
    );
  });

  it('should pass the patterns as a pathspec', async () => {
    mockExecFromRoot.mockResolvedValue('');
    await getNonIgnoredFiles({ patterns: ['*.md', '*.mdx'] });
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md', '*.mdx'],
      { isQuiet: true }
    );
  });

  it('should split the NUL-separated output', async () => {
    mockExecFromRoot.mockResolvedValue('README.md\0docs/guide.md\0');
    expect(await getNonIgnoredFiles()).toEqual(['README.md', 'docs/guide.md']);
  });

  it('should return an empty array when git reports no files', async () => {
    mockExecFromRoot.mockResolvedValue('');
    expect(await getNonIgnoredFiles()).toEqual([]);
  });

  it('should deduplicate paths git lists more than once', async () => {
    mockExecFromRoot.mockResolvedValue('README.md\0README.md\0docs/guide.md\0');
    expect(await getNonIgnoredFiles()).toEqual(['README.md', 'docs/guide.md']);
  });

  it('should return null when git is unavailable or the folder is not a repository', async () => {
    mockExecFromRoot.mockRejectedValue(new Error('not a git repository'));
    expect(await getNonIgnoredFiles()).toBeNull();
  });
});
