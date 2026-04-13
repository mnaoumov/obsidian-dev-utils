import type {
  App,
  CachedMetadata,
  FrontmatterLinkCache,
  Reference,
  ReferenceCache,
  TAbstractFile,
  TFolder
} from 'obsidian';
import type { CustomArrayDict } from 'obsidian-typings';

import { CustomArrayDictImpl } from 'obsidian-typings/implementations';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';
import type { RetryWithTimeoutNoticeParams } from './async-with-notice.ts';
import type { FrontmatterLinkCacheWithOffsets } from './frontmatter-link-cache-with-offsets.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../test-helpers/mock-implementation.ts';
import {
  assertNonNullable,
  ensureGenericObject
} from '../type-guards.ts';
import { getObsidianDevUtilsState } from './app.ts';
import { retryWithTimeoutNotice } from './async-with-notice.ts';
import {
  getFile,
  getFileOrNull
} from './file-system.ts';
import { parseFrontmatter } from './frontmatter.ts';
import {
  ensureMetadataCacheReady,
  getAllLinks,
  getBacklinksForFileOrPath,
  getBacklinksForFileSafe,
  getCacheSafe,
  getFrontmatterSafe,
  parseMetadata,
  registerFileCacheForNonExistingFile,
  registerFiles,
  tempRegisterFilesAndRun,
  tempRegisterFilesAndRunAsync,
  unregisterFileCacheForNonExistingFile,
  unregisterFiles
} from './metadata-cache.ts';
import {
  readSafe,
  saveNote
} from './vault.ts';

interface PathHolder {
  path: string;
}

vi.mock('../obsidian/app.ts', () => ({
  getObsidianDevUtilsState: vi.fn((_app: unknown, _key: string, defaultValue: unknown) => ({ value: defaultValue }))
}));

vi.mock('../obsidian/async-with-notice.ts', () => ({
  retryWithTimeoutNotice: vi.fn()
}));

vi.mock('../obsidian/vault.ts', () => ({
  readSafe: vi.fn(),
  saveNote: vi.fn()
}));

vi.mock('../obsidian/frontmatter.ts', () => ({
  parseFrontmatter: vi.fn()
}));

vi.mock('../obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((fn: (messages: GenericObject) => unknown) => {
    try {
      return fn({ obsidianDevUtils: { metadataCache: { getBacklinksForFilePath: 'mock' } } });
    } catch {
      return 'mock-t';
    }
  })
}));

vi.mock('../obsidian/file-system.ts', () => ({
  getFile: vi.fn((_app: unknown, pathOrFile: unknown) => {
    if (typeof pathOrFile === 'string') {
      return { deleted: true, name: pathOrFile.split('/').pop(), path: pathOrFile };
    }
    return pathOrFile;
  }),
  getFileOrNull: vi.fn((_app: unknown, pathOrFile: unknown) => {
    if (typeof pathOrFile === 'string') {
      return { deleted: false, name: pathOrFile.split('/').pop(), path: pathOrFile, stat: { ctime: 0, mtime: 0, size: 0 } };
    }
    return pathOrFile;
  }),
  getFolder: vi.fn((_app: unknown, path: string) => ({ children: [], deleted: false, path })),
  getPath: vi.fn((_app: unknown, pathOrFile: unknown) => typeof pathOrFile === 'string' ? pathOrFile : (pathOrFile as PathHolder).path),
  isFile: vi.fn((file: unknown) => file !== null && typeof file === 'object' && 'name' in (file as GenericObject) && !('children' in (file as GenericObject)))
}));

vi.mock('../obsidian/frontmatter-link-cache-with-offsets.ts', () => ({
  isFrontmatterLinkCacheWithOffsets: vi.fn((ref: unknown) => {
    const r = ref as GenericObject;
    return r['startOffset'] !== undefined && r['endOffset'] !== undefined && r['key'] !== undefined;
  }),
  toFrontmatterLinkCacheWithOffsets: vi.fn((link: GenericObject) => {
    if (link['startOffset'] !== undefined && link['endOffset'] !== undefined) {
      return link;
    }
    return { ...link, endOffset: typeof link['original'] === 'string' ? link['original'].length : 0, startOffset: 0 };
  })
}));

vi.mock('obsidian-typings/implementations', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as object,
    CustomArrayDictImpl: class {
      public data = new Map<string, unknown[]>();
      public add(key: string, value: unknown): void {
        const arr = this.data.get(key) ?? [];
        arr.push(value);
        this.data.set(key, arr);
      }

      public get(key: string): null | unknown[] {
        return this.data.get(key) ?? null;
      }

      public keys(): string[] {
        return [...this.data.keys()];
      }
    }
  };
});

let app: App;

beforeEach(() => {
  app = createMockApp();
});

const mockedGetFile = vi.mocked(getFile);
const mockedGetFileOrNull = vi.mocked(getFileOrNull);
const mockedSaveNote = vi.mocked(saveNote);
const mockedRetryWithTimeoutNotice = vi.mocked(retryWithTimeoutNotice);
const mockedReadSafe = vi.mocked(readSafe);
const mockedParseFrontmatter = vi.mocked(parseFrontmatter);

interface FrontmatterLinkCacheEx extends FrontmatterLinkCache {
  position?: undefined;
  startOffset?: undefined;
}

interface FrontmatterLinkCacheWithOffsetsEx extends FrontmatterLinkCacheWithOffsets {
  position?: undefined;
}

function createMockApp(): App {
  const fileMap: Record<string, TAbstractFile> = {};

  return strictProxy<App>({
    metadataCache: {
      computeFileMetadataAsync: vi.fn(),
      computeMetadataAsync: vi.fn(),
      fileCache: castTo(Object.create(null)),
      getBacklinksForFile: vi.fn(),
      getFileCache: vi.fn(),
      metadataCache: castTo(Object.create(null)),
      onCleanCache: vi.fn((cb: () => void) => {
        cb();
      }),
      uniqueFileLookup: {
        add: vi.fn(),
        remove: vi.fn()
      }
    },
    vault: {
      fileMap,
      getAbstractFileByPath: (path: string): null | TAbstractFile => fileMap[path] ?? null
    }
  });
}

function makeFrontmatterLink(original: string, key: string): FrontmatterLinkCache {
  return strictProxy<FrontmatterLinkCacheEx>({
    displayText: original,
    key,
    link: original,
    original,
    position: undefined,
    startOffset: undefined
  });
}

function makeFrontmatterLinkWithOffsets(original: string, key: string, startOffset: number, endOffset: number): FrontmatterLinkCache {
  return strictProxy<FrontmatterLinkCacheWithOffsetsEx>({
    displayText: original,
    endOffset,
    key,
    link: original,
    original,
    position: undefined,
    startOffset
  });
}

function makeReferenceCache(original: string, startOffset: number): ReferenceCache {
  return {
    link: original,
    original,
    position: {
      end: { col: 0, line: 0, offset: startOffset + original.length },
      start: { col: 0, line: 0, offset: startOffset }
    }
  } as ReferenceCache;
}

function setVaultEntry(targetApp: App, path: string, value: TAbstractFile): void {
  const fileMap = targetApp.vault.fileMap;
  fileMap[path] = value;
}

describe('getAllLinks', () => {
  it('should return empty array for empty cache', () => {
    const cache: CachedMetadata = {};
    const result = getAllLinks(cache);
    expect(result).toEqual([]);
  });

  it('should return links from cache.links only', () => {
    const link = makeReferenceCache('[[note]]', 0);
    const cache: CachedMetadata = { links: [link] };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(link);
  });

  it('should return links from cache.embeds only', () => {
    const embed = makeReferenceCache('![[image.png]]', 10);
    const cache: CachedMetadata = { embeds: [embed] };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(embed);
  });

  it('should return links from cache.frontmatterLinks only', () => {
    const fmLink = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = { frontmatterLinks: [fmLink] };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(fmLink);
  });

  it('should combine links, embeds, and frontmatterLinks', () => {
    const link = makeReferenceCache('[[note]]', 0);
    const embed = makeReferenceCache('![[image.png]]', 20);
    const fmLink = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = {
      embeds: [embed],
      frontmatterLinks: [fmLink],
      links: [link]
    };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(3);
  });

  it('should deduplicate reference caches with same start offset', () => {
    const link1 = makeReferenceCache('[[note]]', 0);
    const link2 = makeReferenceCache('[[note]]', 0);
    const cache: CachedMetadata = { links: [link1, link2] };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(1);
  });

  it('should keep reference caches with different start offsets', () => {
    const link1 = makeReferenceCache('[[note1]]', 0);
    const link2 = makeReferenceCache('[[note2]]', 20);
    const cache: CachedMetadata = { links: [link1, link2] };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(2);
  });

  it('should deduplicate frontmatter links with same key and no offsets', () => {
    const fmLink1 = makeFrontmatterLink('note', 'aliases');
    const fmLink2 = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(1);
  });

  it('should keep frontmatter links with different keys', () => {
    const fmLink1 = makeFrontmatterLink('note1', 'aliases');
    const fmLink2 = makeFrontmatterLink('note2', 'related');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(2);
  });

  it('should deduplicate frontmatter links with offsets when same key and same startOffset', () => {
    const fmLink1 = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const fmLink2 = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(1);
  });

  it('should keep frontmatter links with offsets when different startOffsets', () => {
    const fmLink1 = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const fmLink2 = makeFrontmatterLinkWithOffsets('other', 'aliases', 5, 10);
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(2);
  });

  it('should not deduplicate a frontmatter link with offsets against one without offsets for same key', () => {
    const fmLinkWithOffsets = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const fmLinkWithout = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLinkWithOffsets, fmLinkWithout]
    };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(2);
  });

  it('should not deduplicate mixed types (reference + frontmatter)', () => {
    const refLink = makeReferenceCache('[[note]]', 0);
    const fmLink = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink],
      links: [refLink]
    };
    const result = getAllLinks(cache);
    expect(result).toHaveLength(2);
  });
});

describe('ensureMetadataCacheReady', () => {
  it('should resolve when onCleanCache calls the callback', async () => {
    await ensureMetadataCacheReady(app);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.onCleanCache).toHaveBeenCalledOnce();
  });

  it('should wait for async resolution of onCleanCache', async () => {
    app.metadataCache.onCleanCache = vi.fn((cb: () => void) => {
      setTimeout(cb, 0);
    });
    await ensureMetadataCacheReady(app);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.onCleanCache).toHaveBeenCalledOnce();
  });
});

describe('parseMetadata', () => {
  it('should encode string and call computeMetadataAsync', async () => {
    const mockCache: CachedMetadata = { links: [] };

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(mockCache);

    const result = await parseMetadata(app, 'test string');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.computeMetadataAsync).toHaveBeenCalledOnce();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    const callArg = vi.mocked(app.metadataCache.computeMetadataAsync).mock.calls[0]?.[0];
    assertNonNullable(callArg);
    const decoded = new TextDecoder().decode(callArg);
    expect(decoded).toBe('test string');
    expect(result).toBe(mockCache);
  });

  it('should return empty object when computeMetadataAsync returns null', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(undefined);

    const result = await parseMetadata(app, 'test');
    expect(result).toEqual({});
  });
});

describe('registerFileCacheForNonExistingFile', () => {
  beforeEach(() => {
    mockedGetFile.mockReset();
  });

  it('should register file cache when file is deleted', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' };
    const cache: CachedMetadata = { links: [] };

    mockedGetFile.mockReturnValue(castTo<ReturnType<typeof getFile>>(file));

    registerFileCacheForNonExistingFile(app, file as never, cache);

    expect(app.metadataCache.fileCache['folder/note.md']).toEqual({
      hash: 'folder/note.md',
      mtime: 0,
      size: 0
    });
    expect(app.metadataCache.metadataCache['folder/note.md']).toBe(cache);
  });

  it('should throw when file is not deleted', () => {
    const file = { deleted: false, name: 'note.md', path: 'folder/note.md' };

    mockedGetFile.mockReturnValue(castTo<ReturnType<typeof getFile>>(file));

    expect(() => {
      registerFileCacheForNonExistingFile(app, file as never, {});
    })
      .toThrow('File is existing');
  });
});

describe('unregisterFileCacheForNonExistingFile', () => {
  beforeEach(() => {
    mockedGetFile.mockReset();
  });

  it('should delete file cache entries when file is deleted', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' };
    app.metadataCache.fileCache['folder/note.md'] = { hash: 'folder/note.md', mtime: 0, size: 0 };
    app.metadataCache.metadataCache['folder/note.md'] = { links: [] };

    mockedGetFile.mockReturnValue(castTo<ReturnType<typeof getFile>>(file));

    unregisterFileCacheForNonExistingFile(app, file as never);

    expect(app.metadataCache.fileCache['folder/note.md']).toBeUndefined();
    expect(app.metadataCache.metadataCache['folder/note.md']).toBeUndefined();
  });

  it('should throw when file is not deleted', () => {
    const file = { deleted: false, name: 'note.md', path: 'folder/note.md' };

    mockedGetFile.mockReturnValue(castTo<ReturnType<typeof getFile>>(file));

    expect(() => {
      unregisterFileCacheForNonExistingFile(app, file as never);
    })
      .toThrow('File is existing');
  });
});

describe('registerFiles', () => {
  it('should register a deleted file into fileMap', () => {
    const file = strictProxy<TAbstractFile>({ deleted: true, name: 'note.md', path: 'folder/note.md' });

    registerFiles(app, [file]);

    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBe(file);
  });

  it('should call uniqueFileLookup.add for file-like deleted entries', () => {
    const file = strictProxy<TAbstractFile>({ deleted: true, name: 'note.md', path: 'folder/note.md' });

    registerFiles(app, [file]);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.uniqueFileLookup.add).toHaveBeenCalledWith('note.md', file);
  });

  it('should not register a non-deleted file', () => {
    const file = strictProxy<TAbstractFile>({ deleted: false, name: 'note.md', path: 'folder/note.md' });

    registerFiles(app, [file]);

    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBeNull();
  });

  it('should not call uniqueFileLookup.add for folder-like deleted entries', () => {
    const folder = strictProxy<TFolder>({ children: [], deleted: true, path: 'folder' });

    registerFiles(app, [folder]);

    expect(app.vault.getAbstractFileByPath('folder')).toBe(folder);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.uniqueFileLookup.add).not.toHaveBeenCalled();
  });
});

describe('unregisterFiles', () => {
  it('should remove a deleted file from fileMap when count reaches 0', () => {
    const file = strictProxy<TAbstractFile>({ deleted: true, name: 'note.md', path: 'folder/note.md' });
    setVaultEntry(app, 'folder/note.md', file);

    unregisterFiles(app, [file]);

    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBeNull();
  });

  it('should call uniqueFileLookup.remove for file-like deleted entries when count reaches 0', () => {
    const file = strictProxy<TAbstractFile>({ deleted: true, name: 'note.md', path: 'folder/note.md' });
    setVaultEntry(app, 'folder/note.md', file);

    unregisterFiles(app, [file]);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.uniqueFileLookup.remove).toHaveBeenCalledWith('note.md', file);
  });

  it('should not remove a non-deleted file', () => {
    const file = strictProxy<TAbstractFile>({ deleted: false, name: 'note.md', path: 'folder/note.md' });
    setVaultEntry(app, 'folder/note.md', file);

    unregisterFiles(app, [file]);

    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBe(file);
  });

  it('should not call uniqueFileLookup.remove for folder-like deleted entries', () => {
    const folder = strictProxy<TFolder>({ children: [], deleted: true, path: 'folder' });
    setVaultEntry(app, 'folder', folder);

    unregisterFiles(app, [folder]);

    expect(app.vault.getAbstractFileByPath('folder')).toBeNull();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.uniqueFileLookup.remove).not.toHaveBeenCalled();
  });

  it('should not remove file from fileMap when count is still positive', () => {
    const sharedMap = new Map<string, number>();
    const mockedGetState = vi.mocked(getObsidianDevUtilsState);
    mockedGetState.mockReturnValue({ value: sharedMap });

    const file = strictProxy<TAbstractFile>({ deleted: true, name: 'note.md', path: 'folder/note.md' });

    registerFiles(app, [file]);
    registerFiles(app, [file]);
    unregisterFiles(app, [file]);

    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBe(file);

    mockedGetState.mockImplementation((_app: unknown, _key: string, defaultValue: unknown) => ({ value: defaultValue }));
  });
});

describe('tempRegisterFilesAndRun', () => {
  it('should run the function and return its result', () => {
    const file = strictProxy<TAbstractFile>({ deleted: false, name: 'note.md', path: 'note.md' });
    const result = tempRegisterFilesAndRun(app, [file], () => 42);
    expect(result).toBe(42);
  });

  it('should still unregister files even when fn throws', () => {
    const file = strictProxy<TAbstractFile>({ deleted: false, name: 'note.md', path: 'note.md' });
    expect(() =>
      tempRegisterFilesAndRun(app, [file], () => {
        throw new Error('test error');
      })
    ).toThrow('test error');
  });
});

describe('tempRegisterFilesAndRunAsync', () => {
  it('should run the async function and return its result', async () => {
    const file = strictProxy<TAbstractFile>({ deleted: false, name: 'note.md', path: 'note.md' });
    const result = await tempRegisterFilesAndRunAsync(app, [file], async () => 'hello');
    expect(result).toBe('hello');
  });

  it('should still unregister files even when fn rejects', async () => {
    const file = strictProxy<TAbstractFile>({ deleted: false, name: 'note.md', path: 'note.md' });
    await expect(tempRegisterFilesAndRunAsync(app, [file], async () => {
      throw new Error('async error');
    })).rejects.toThrow('async error');
  });
});

describe('getBacklinksForFileOrPath', () => {
  beforeEach(() => {
    mockedGetFile.mockReset();
    mockedGetFile.mockImplementation((_app: unknown, pathOrFile: unknown) => {
      if (typeof pathOrFile === 'string') {
        return castTo<ReturnType<typeof getFile>>({ deleted: true, name: pathOrFile.split('/').pop(), path: pathOrFile });
      }
      return pathOrFile as ReturnType<typeof getFile>;
    });
  });

  it('should call getBacklinksForFile and return result', () => {
    const mockBacklinks = { data: new Map() };

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(mockBacklinks as ReturnType<typeof app.metadataCache.getBacklinksForFile>);

    const result = getBacklinksForFileOrPath(app, 'test.md');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.getBacklinksForFile).toHaveBeenCalled();
    expect(result).toBe(mockBacklinks);
  });
});

describe('getCacheSafe', () => {
  beforeEach(() => {
    mockedGetFileOrNull.mockReset();
    mockedSaveNote.mockReset();
    mockedSaveNote.mockResolvedValue(undefined);
  });

  it('should return null when file does not exist', async () => {
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(null));

    const result = await getCacheSafe(app, 'nonexistent.md');
    expect(result).toBeNull();
  });

  it('should return file cache directly for deleted file', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache as ReturnType<typeof app.metadataCache.getFileCache>);

    const result = await getCacheSafe(app, file as never);
    expect(result).toBe(mockCache);
  });

  it('should compute metadata if cache is not up to date', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 100, size: 50 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache as ReturnType<typeof app.metadataCache.getFileCache>);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.computeFileMetadataAsync).mockResolvedValue(undefined);

    const result = await getCacheSafe(app, file as never);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.computeFileMetadataAsync).toHaveBeenCalledWith(file);
    expect(result).toBe(mockCache);
  });

  it('should not recompute if cache is up to date', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 100, size: 50 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));
    app.metadataCache.fileCache['note.md'] = { hash: 'abc', mtime: 100, size: 50 };
    app.metadataCache.metadataCache['abc'] = mockCache;

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache as ReturnType<typeof app.metadataCache.getFileCache>);

    const result = await getCacheSafe(app, file as never);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    expect(app.metadataCache.computeFileMetadataAsync).not.toHaveBeenCalled();
    expect(result).toBe(mockCache);
  });

  it('should return null if deleted file throws an error', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getFileCache).mockImplementation(() => {
      throw new Error('cache error');
    });

    const result = await getCacheSafe(app, file as never);
    expect(result).toBeNull();
  });

  it('should rethrow error for non-deleted existing file', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));
    mockedSaveNote.mockRejectedValue(new Error('save error'));

    await expect(getCacheSafe(app, file as never)).rejects.toThrow('save error');
  });
});

describe('getFrontmatterSafe', () => {
  beforeEach(() => {
    mockedGetFileOrNull.mockReset();
    mockedSaveNote.mockReset();
    mockedSaveNote.mockResolvedValue(undefined);
  });

  it('should return frontmatter from cache', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };
    const mockFrontmatter = { title: 'Test' };
    const mockCache = castTo<CachedMetadata>({ frontmatter: mockFrontmatter });

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache as ReturnType<typeof app.metadataCache.getFileCache>);

    const result = await getFrontmatterSafe(app, file as never);
    expect(result).toBe(mockFrontmatter);
  });

  it('should return empty object when cache has no frontmatter', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };
    const mockCache: CachedMetadata = {};

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache as ReturnType<typeof app.metadataCache.getFileCache>);

    const result = await getFrontmatterSafe(app, file as never);
    expect(result).toEqual({});
  });

  it('should return empty object when cache is null', async () => {
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(null));

    const result = await getFrontmatterSafe(app, 'nonexistent.md');
    expect(result).toEqual({});
  });
});

describe('getBacklinksForFileSafe', () => {
  function setupRetryToInvokeOperationFn(): void {
    mockedRetryWithTimeoutNotice.mockImplementation(async (params: RetryWithTimeoutNoticeParams) => {
      const operationFn = params.operationFn;
      const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
      await operationFn(abortSignal);
    });
  }

  function createBacklinksDict(entries: Record<string, Reference[]>): CustomArrayDict<Reference> {
    const dict = new CustomArrayDictImpl<Reference>();

    for (const [key, references] of Object.entries(entries)) {
      for (const reference of references) {
        dict.add(key, reference);
      }
    }

    return dict;
  }

  beforeEach(() => {
    mockedGetFile.mockReset();
    mockedGetFileOrNull.mockReset();
    mockedSaveNote.mockReset();
    mockedReadSafe.mockReset();
    mockedParseFrontmatter.mockReset();
    mockedRetryWithTimeoutNotice.mockReset();
    mockedSaveNote.mockResolvedValue(undefined);

    mockedGetFile.mockImplementation((_app: unknown, pathOrFile: unknown) => {
      if (typeof pathOrFile === 'string') {
        return castTo<ReturnType<typeof getFile>>({ deleted: true, name: pathOrFile.split('/').pop(), path: pathOrFile });
      }
      return pathOrFile as ReturnType<typeof getFile>;
    });
  });

  it('should use safe overload when available', async () => {
    const mockResult = { get: vi.fn(), keys: vi.fn().mockReturnValue([]) };
    const safeFn = vi.fn().mockResolvedValue(mockResult);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    ensureGenericObject(app.metadataCache.getBacklinksForFile)['safe'] = safeFn;

    const result = await getBacklinksForFileSafe(app, 'test.md');
    expect(safeFn).toHaveBeenCalledWith('test.md');
    expect(result).toBe(mockResult);
  });

  it('should default shouldShowTimeoutNotice to true', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    await getBacklinksForFileSafe(app, 'test.md');

    const callArg = mockedRetryWithTimeoutNotice.mock.calls[0]?.[0] as GenericObject | undefined;
    expect(callArg?.['shouldShowTimeoutNotice']).toBe(true);
  });

  it('should pass shouldShowTimeoutNotice from params', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    await getBacklinksForFileSafe(app, 'test.md', { shouldShowTimeoutNotice: false });

    const callArg = mockedRetryWithTimeoutNotice.mock.calls[0]?.[0] as GenericObject | undefined;
    expect(callArg?.['shouldShowTimeoutNotice']).toBe(false);
  });

  it('should return backlinks for empty backlinks dict', async () => {
    setupRetryToInvokeOperationFn();
    const backlinksDict = createBacklinksDict({});

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(backlinksDict);

    const result = await getBacklinksForFileSafe(app, 'test.md');
    expect(result).toBe(backlinksDict);
  });

  it('should return false when getFileOrNull returns null for note', async () => {
    setupRetryToInvokeOperationFn();
    const refLink = makeReferenceCache('[[target]]', 10);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue(null as never);

    await getBacklinksForFileSafe(app, 'target.md');
    expect(mockedGetFileOrNull).toHaveBeenCalled();
  });

  it('should return false when readSafe returns null', async () => {
    setupRetryToInvokeOperationFn();
    const refLink = makeReferenceCache('[[target]]', 10);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue(null as never);

    await getBacklinksForFileSafe(app, 'target.md');
    expect(mockedReadSafe).toHaveBeenCalled();
  });

  it('should return false when backlinks.get returns null for note', async () => {
    setupRetryToInvokeOperationFn();
    const backlinksDict = {
      get: (): null => null,
      keys: (): string[] => ['source.md']
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(castTo<ReturnType<typeof app.metadataCache.getBacklinksForFile>>(backlinksDict));
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue('some content');
    mockedParseFrontmatter.mockReturnValue({});

    await getBacklinksForFileSafe(app, 'target.md');
    expect(mockedParseFrontmatter).toHaveBeenCalled();
  });

  it('should succeed when reference cache link matches content', async () => {
    setupRetryToInvokeOperationFn();
    const content = '0123456789[[target]]more text';
    const refLink = makeReferenceCache('[[target]]', 10);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue(content);
    mockedParseFrontmatter.mockReturnValue({});

    const result = await getBacklinksForFileSafe(app, 'target.md');
    expect(result.keys()).toEqual(['source.md']);
  });

  it('should return false when reference cache link does not match content', async () => {
    let operationResult: boolean | undefined;
    mockedRetryWithTimeoutNotice.mockImplementation(async (params: RetryWithTimeoutNoticeParams) => {
      const operationFn = params.operationFn;
      const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
      operationResult = await operationFn(abortSignal);
    });
    const content = '0123456789XXMISMATCHX more text';
    const refLink = makeReferenceCache('[[target]]', 10);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue(content);
    mockedParseFrontmatter.mockReturnValue({});

    await getBacklinksForFileSafe(app, 'target.md');
    expect(operationResult).toBe(false);
  });

  it('should succeed when frontmatter link matches property value', async () => {
    setupRetryToInvokeOperationFn();
    const fmLink = makeFrontmatterLink('target-note', 'aliases');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [fmLink] })
    );
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue('---\naliases: target-note\n---');
    mockedParseFrontmatter.mockReturnValue({ aliases: ['target-note'] });

    const result = await getBacklinksForFileSafe(app, 'target.md');
    expect(result.keys()).toEqual(['source.md']);
  });

  it('should return false when frontmatter property value is not a string', async () => {
    let operationResult: boolean | undefined;
    mockedRetryWithTimeoutNotice.mockImplementation(async (params: RetryWithTimeoutNoticeParams) => {
      const operationFn = params.operationFn;
      const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
      operationResult = await operationFn(abortSignal);
    });
    const fmLink = makeFrontmatterLink('target-note', 'aliases');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [fmLink] })
    );
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue('---\naliases: 123\n---');
    mockedParseFrontmatter.mockReturnValue({ aliases: 123 } as never);

    await getBacklinksForFileSafe(app, 'target.md');
    expect(operationResult).toBe(false);
  });

  it('should return false when frontmatter link does not match property value', async () => {
    let operationResult: boolean | undefined;
    mockedRetryWithTimeoutNotice.mockImplementation(async (params: RetryWithTimeoutNoticeParams) => {
      const operationFn = params.operationFn;
      const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
      operationResult = await operationFn(abortSignal);
    });
    const fmLink = makeFrontmatterLink('target-note', 'aliases');

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [fmLink] })
    );
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue('---\naliases: different\n---');
    mockedParseFrontmatter.mockReturnValue({ aliases: 'different-value' } as never);

    await getBacklinksForFileSafe(app, 'target.md');
    expect(operationResult).toBe(false);
  });

  it('should return true for links that are neither reference nor frontmatter', async () => {
    setupRetryToInvokeOperationFn();
    const unknownLink = { link: 'something', original: 'something' };

    // eslint-disable-next-line @typescript-eslint/unbound-method -- Valid usage.
    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [unknownLink] })
    );
    mockedGetFileOrNull.mockReturnValue({ path: 'source.md' } as never);
    mockedReadSafe.mockResolvedValue('content');
    mockedParseFrontmatter.mockReturnValue({});

    const result = await getBacklinksForFileSafe(app, 'target.md');
    expect(result.keys()).toEqual(['source.md']);
  });
});
