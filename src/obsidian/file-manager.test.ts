import type {
  App as AppOriginal,
  TFile
} from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';
import type { GetFileParams } from './file-system.ts';
import type { ResourceLockComponent } from './resource-lock.ts';

import { noop } from '../function.ts';
import { deepEqual } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { ensureNonNullable } from '../type-guards.ts';
import { resolveValue } from '../value-provider.ts';
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

interface PathHolder {
  path: string;
}

vi.mock('../object-utils.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../object-utils.ts')>();
  return {
    ...original,
    deepEqual: vi.fn(() => false)
  };
});

vi.mock('../obsidian/file-system.ts', () => ({
  getFile: vi.fn((params: GetFileParams) => {
    const { pathOrFile } = params;
    if (typeof pathOrFile === 'string') {
      return { basename: pathOrFile.replace(/\.[^.]+$/, ''), extension: 'md', name: pathOrFile, path: pathOrFile };
    }
    return pathOrFile;
  }),
  getPath: vi.fn((_app: unknown, p: unknown) => typeof p === 'string' ? p : (p as PathHolder).path),
  isMarkdownFile: vi.fn(() => true)
}));

vi.mock('../obsidian/frontmatter.ts', () => ({
  parseFrontmatter: vi.fn(() => ({})),
  setFrontmatter: vi.fn((_content: string, fm: unknown) => `---\n${ensureNonNullable(JSON.stringify(fm))}\n---\ncontent`)
}));

vi.mock('../obsidian/vault.ts', () => ({
  process: vi.fn()
}));

const resourceLockComponent = strictProxy<ResourceLockComponent>({
  lockForPath: () => ({ [Symbol.dispose]: noop })
});

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

describe('addAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\n---\ncontent' });
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});
    vi.mocked(deepEqual).mockReturnValue(false);
  });

  it('should do nothing when alias is empty', async () => {
    await addAlias({ alias: '', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).not.toHaveBeenCalled();
  });

  it('should do nothing when alias is undefined', async () => {
    await addAlias({ app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).not.toHaveBeenCalled();
  });

  it('should throw when file is not a markdown file', async () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    await expect(addAlias({ alias: 'my-alias', app, pathOrFile: 'image.png', resourceLockComponent })).rejects.toThrow('not a markdown file');
  });

  it('should do nothing when alias matches basename', async () => {
    vi.mocked(getFile).mockReturnValue(strictProxy<TFile>({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' }));
    await addAlias({ alias: 'note', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).not.toHaveBeenCalled();
  });

  it('should do nothing when alias matches file name', async () => {
    vi.mocked(getFile).mockReturnValue(strictProxy<TFile>({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' }));
    await addAlias({ alias: 'note.md', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).not.toHaveBeenCalled();
  });

  it('should add an alias to frontmatter', async () => {
    const frontmatter: GenericObject = {};
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);
    vi.mocked(getFile).mockReturnValue(strictProxy<TFile>({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' }));

    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\n---\ncontent' });
    });

    await addAlias({ alias: 'my-alias', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).toHaveBeenCalled();
  });

  it('should not add a duplicate alias', async () => {
    const frontmatter = { aliases: ['existing-alias'] };
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);
    vi.mocked(getFile).mockReturnValue(strictProxy<TFile>({ basename: 'note', extension: 'md', name: 'note.md', path: 'note.md' }));

    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\naliases: existing-alias\n---\ncontent' });
    });

    await addAlias({ alias: 'existing-alias', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(frontmatter.aliases).toEqual(['existing-alias']);
  });
});

describe('deleteAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMarkdownFile).mockReturnValue(true);
    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\naliases: some-alias\n---\ncontent' });
    });
    vi.mocked(parseFrontmatter).mockReturnValue({ aliases: ['some-alias'] });
    vi.mocked(deepEqual).mockReturnValue(false);
  });

  it('should do nothing when alias is empty', async () => {
    await deleteAlias({ alias: '', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).not.toHaveBeenCalled();
  });

  it('should do nothing when alias is undefined', async () => {
    await deleteAlias({ app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).not.toHaveBeenCalled();
  });

  it('should throw when file is not a markdown file', async () => {
    vi.mocked(isMarkdownFile).mockReturnValue(false);
    await expect(deleteAlias({ alias: 'my-alias', app, pathOrFile: 'image.png', resourceLockComponent })).rejects.toThrow('not a markdown file');
  });

  it('should delete an alias from frontmatter', async () => {
    const frontmatter = { aliases: ['keep', 'remove'] };
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);

    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\naliases:\n  - keep\n  - remove\n---\ncontent' });
    });

    await deleteAlias({ alias: 'remove', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).toHaveBeenCalled();
  });

  it('should delete aliases property when array becomes empty', async () => {
    const frontmatter: GenericObject = { aliases: ['only'] };
    vi.mocked(parseFrontmatter).mockReturnValue(frontmatter);

    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\naliases: only\n---\ncontent' });
    });

    await deleteAlias({ alias: 'only', app, pathOrFile: 'note.md', resourceLockComponent });
    expect(process).toHaveBeenCalled();
  });

  it('should do nothing when aliases property does not exist', async () => {
    vi.mocked(parseFrontmatter).mockReturnValue({});

    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\n---\ncontent' });
    });

    await deleteAlias({ alias: 'my-alias', app, pathOrFile: 'note.md', resourceLockComponent });
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
    await expect(processFrontmatter({ app, frontmatterFn: vi.fn(), pathOrFile: 'image.png', pluginNoticeComponent: null, resourceLockComponent })).rejects.toThrow('not a markdown file');
  });

  it('should call process with the file', async () => {
    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\n---\ncontent' });
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});

    const frontmatterFn = vi.fn();
    await processFrontmatter({ app, frontmatterFn, pathOrFile: 'note.md', pluginNoticeComponent: null, resourceLockComponent });
    expect(process).toHaveBeenCalled();
    expect(frontmatterFn).toHaveBeenCalled();
  });

  it('should return null when frontmatterFn returns null', async () => {
    let resultContent: null | string = 'initial';

    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      resultContent = await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\n---\ncontent' });
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});

    await processFrontmatter({ app, frontmatterFn: () => null, pathOrFile: 'note.md', pluginNoticeComponent: null, resourceLockComponent });
    expect(resultContent).toBeNull();
  });

  it('should return original content when frontmatter is unchanged', async () => {
    const content = '---\ntitle: test\n---\ncontent';
    let resultContent: null | string = null;

    vi.mocked(deepEqual).mockReturnValue(true);
    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      resultContent = await resolveValue(newContentProvider, { abortSignal: controller.signal, content });
    });
    vi.mocked(parseFrontmatter).mockReturnValue({ title: 'test' });

    await processFrontmatter({ app, frontmatterFn: vi.fn(), pathOrFile: 'note.md', pluginNoticeComponent: null, resourceLockComponent });
    expect(resultContent).toBe(content);
    expect(setFrontmatter).not.toHaveBeenCalled();
  });

  it('should call setFrontmatter when frontmatter changed', async () => {
    const content = '---\ntitle: old\n---\ncontent';
    vi.mocked(deepEqual).mockReturnValue(false);
    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content });
    });
    vi.mocked(parseFrontmatter).mockReturnValue({ title: 'old' });
    vi.mocked(setFrontmatter).mockReturnValue('---\ntitle: new\n---\ncontent');

    await processFrontmatter({
      app,
      frontmatterFn: (fm) => {
        fm['title'] = 'new';
      },
      pathOrFile: 'note.md',
      pluginNoticeComponent: null,
      resourceLockComponent
    });
    expect(setFrontmatter).toHaveBeenCalled();
  });

  it('should pass processOptions to process', async () => {
    vi.mocked(process).mockImplementation(async ({ newContentProvider }) => {
      const controller = new AbortController();
      await resolveValue(newContentProvider, { abortSignal: controller.signal, content: '---\n---\ncontent' });
    });
    vi.mocked(parseFrontmatter).mockReturnValue({});

    const processOptions = { timeoutInMilliseconds: 5000 };
    await processFrontmatter({ app, frontmatterFn: vi.fn(), pathOrFile: 'note.md', pluginNoticeComponent: null, resourceLockComponent, ...processOptions });
    const params = vi.mocked(process).mock.calls[0]?.[0];
    expect(params?.app).toBe(app);
    expect(params?.pathOrFile).toBe('note.md');
    expect(params?.timeoutInMilliseconds).toBe(5000);
  });
});
