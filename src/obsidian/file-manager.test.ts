import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

import { deepEqual } from '../object-utils.ts';
import { ensureNonNullable } from '../type-guards.ts';
import {
  addAlias,
  deleteAlias,
  processFrontmatter
} from './file-manager.ts';
import {
  getFile,
  isMarkdownFile
} from './file-system.ts';
import {
  parseFrontmatter,
  setFrontmatter
} from './frontmatter.ts';
import { process } from './vault.ts';

vi.mock('../object-utils.ts', () => ({
  deepEqual: vi.fn(() => false)
}));

vi.mock('../obsidian/file-system.ts', () => ({
  getFile: vi.fn((_app: unknown, pathOrFile: unknown) => {
    if (typeof pathOrFile === 'string') {
      return { basename: pathOrFile.replace(/\.[^.]+$/, ''), extension: 'md', name: pathOrFile, path: pathOrFile };
    }
    return pathOrFile;
  }),
  getPath: vi.fn((_app: unknown, p: unknown) => typeof p === 'string' ? p : (p as { path: string }).path),
  isMarkdownFile: vi.fn(() => true)
}));

vi.mock('../obsidian/frontmatter.ts', () => ({
  parseFrontmatter: vi.fn(() => ({})),
  setFrontmatter: vi.fn((_content: string, fm: unknown) => `---\n${ensureNonNullable(JSON.stringify(fm))}\n---\ncontent`)
}));

vi.mock('../obsidian/vault.ts', () => ({
  process: vi.fn()
}));

type ProcessFn = (abortSignal: AbortSignal, content: string) => Promise<null | string>;

describe('addAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\n---\ncontent');
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});
    vi.mocked(deepEqual).mockReturnValue(false);
  });

  it('should do nothing when alias is empty', async () => {
    await addAlias({} as never, 'note.md', '');
    expect(process).not.toHaveBeenCalled();
  });

  it('should do nothing when alias is undefined', async () => {
    await addAlias({} as never, 'note.md', undefined);
    expect(process).not.toHaveBeenCalled();
  });

  it('should throw when file is not a markdown file', async () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    await expect(addAlias({} as never, 'image.png', 'my-alias')).rejects.toThrow('not a markdown file');
  });

  it('should do nothing when alias matches basename', async () => {
    vi.mocked(getFile).mockReturnValue({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' } as never);
    await addAlias({} as never, 'note.md', 'note');
    expect(process).not.toHaveBeenCalled();
  });

  it('should do nothing when alias matches file name', async () => {
    vi.mocked(getFile).mockReturnValue({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' } as never);
    await addAlias({} as never, 'note.md', 'note.md');
    expect(process).not.toHaveBeenCalled();
  });

  it('should add an alias to frontmatter', async () => {
    const frontmatter: GenericObject = {};
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);
    vi.mocked(getFile).mockReturnValue({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' } as never);

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\n---\ncontent');
    });

    await addAlias({} as never, 'note.md', 'my-alias');
    expect(process).toHaveBeenCalled();
  });

  it('should not add a duplicate alias', async () => {
    const frontmatter = { aliases: ['existing-alias'] };
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);
    vi.mocked(getFile).mockReturnValue({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' } as never);

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\naliases: existing-alias\n---\ncontent');
    });

    await addAlias({} as never, 'note.md', 'existing-alias');
    expect(frontmatter.aliases).toEqual(['existing-alias']);
  });
});

describe('deleteAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\naliases: some-alias\n---\ncontent');
    });
    vi.mocked(parseFrontmatter).mockReturnValue({ aliases: ['some-alias'] });
    vi.mocked(deepEqual).mockReturnValue(false);
  });

  it('should do nothing when alias is empty', async () => {
    await deleteAlias({} as never, 'note.md', '');
    expect(process).not.toHaveBeenCalled();
  });

  it('should do nothing when alias is undefined', async () => {
    await deleteAlias({} as never, 'note.md', undefined);
    expect(process).not.toHaveBeenCalled();
  });

  it('should throw when file is not a markdown file', async () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    await expect(deleteAlias({} as never, 'image.png', 'my-alias')).rejects.toThrow('not a markdown file');
  });

  it('should delete an alias from frontmatter', async () => {
    const frontmatter = { aliases: ['keep', 'remove'] };
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\naliases:\n  - keep\n  - remove\n---\ncontent');
    });

    await deleteAlias({} as never, 'note.md', 'remove');
    expect(process).toHaveBeenCalled();
  });

  it('should delete aliases property when array becomes empty', async () => {
    const frontmatter: GenericObject = { aliases: ['only'] };
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\naliases: only\n---\ncontent');
    });

    await deleteAlias({} as never, 'note.md', 'only');
    expect(process).toHaveBeenCalled();
  });

  it('should do nothing when aliases property does not exist', async () => {
    vi.mocked(parseFrontmatter).mockReturnValue({});

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\n---\ncontent');
    });

    await deleteAlias({} as never, 'note.md', 'my-alias');
    expect(process).toHaveBeenCalled();
  });
});

describe('processFrontmatter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    vi.mocked(deepEqual).mockReturnValue(false);
  });

  it('should throw when file is not a markdown file', async () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    await expect(processFrontmatter({} as never, 'image.png', vi.fn())).rejects.toThrow('not a markdown file');
  });

  it('should call process with the file', async () => {
    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\n---\ncontent');
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});

    const frontmatterFn = vi.fn();
    await processFrontmatter({} as never, 'note.md', frontmatterFn);
    expect(process).toHaveBeenCalled();
    expect(frontmatterFn).toHaveBeenCalled();
  });

  it('should return null when frontmatterFn returns null', async () => {
    let resultContent: null | string = 'initial';

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, '---\n---\ncontent');
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});

    await processFrontmatter({} as never, 'note.md', () => null);
    expect(resultContent).toBeNull();
  });

  it('should return original content when frontmatter is unchanged', async () => {
    const content = '---\ntitle: test\n---\ncontent';
    let resultContent: null | string = null;

    vi.mocked(deepEqual).mockReturnValue(true);
    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, content);
    });
    vi.mocked(parseFrontmatter).mockReturnValue({ title: 'test' });

    await processFrontmatter({} as never, 'note.md', vi.fn());
    expect(resultContent).toBe(content);
    expect(setFrontmatter).not.toHaveBeenCalled();
  });

  it('should call setFrontmatter when frontmatter changed', async () => {
    const content = '---\ntitle: old\n---\ncontent';
    vi.mocked(deepEqual).mockReturnValue(false);
    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, content);
    });
    vi.mocked(parseFrontmatter).mockReturnValue({ title: 'old' });
    vi.mocked(setFrontmatter).mockReturnValue('---\ntitle: new\n---\ncontent');

    await processFrontmatter({} as never, 'note.md', (fm) => {
      fm['title'] = 'new';
    });
    expect(setFrontmatter).toHaveBeenCalled();
  });

  it('should pass processOptions to process', async () => {
    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, '---\n---\ncontent');
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});

    const processOptions = { timeoutInMilliseconds: 5000 };
    await processFrontmatter({} as never, 'note.md', vi.fn(), processOptions);
    expect(process).toHaveBeenCalledWith(expect.anything(), 'note.md', expect.any(Function), processOptions);
  });
});
