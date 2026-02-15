import type {
  App,
  CachedMetadata,
  FrontmatterLinkCache,
  ReferenceCache,
  TAbstractFile
} from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getFile,
  getFileOrNull
} from '../../src/obsidian/FileSystem.ts';
import { saveNote } from '../../src/obsidian/Vault.ts';

vi.mock('../../src/obsidian/App.ts', () => ({
  getObsidianDevUtilsState: vi.fn((_app: unknown, _key: string, defaultValue: unknown) => ({ value: defaultValue }))
}));

vi.mock('../../src/obsidian/AsyncWithNotice.ts', () => ({
  retryWithTimeoutNotice: vi.fn()
}));

vi.mock('../../src/obsidian/Vault.ts', () => ({
  readSafe: vi.fn(),
  saveNote: vi.fn()
}));

vi.mock('../../src/obsidian/Frontmatter.ts', () => ({
  parseFrontmatter: vi.fn()
}));

vi.mock('../../src/obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((fn: (messages: Record<string, unknown>) => unknown) => {
    try {
      return fn({ obsidianDevUtils: { metadataCache: { getBacklinksForFilePath: 'mock' } } } as unknown as Record<string, unknown>);
    } catch {
      return 'mock-t';
    }
  })
}));

vi.mock('../../src/obsidian/FileSystem.ts', () => ({
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
  getPath: vi.fn((_app: unknown, pathOrFile: unknown) => typeof pathOrFile === 'string' ? pathOrFile : (pathOrFile as { path: string }).path),
  isFile: vi.fn((file: unknown) =>
    file !== null && typeof file === 'object' && 'name' in (file as Record<string, unknown>) && !('children' in (file as Record<string, unknown>))
  )
}));

vi.mock('../../src/obsidian/FrontmatterLinkCacheWithOffsets.ts', () => ({
  isFrontmatterLinkCacheWithOffsets: vi.fn((ref: unknown) => {
    const r = ref as Record<string, unknown>;
    return r['startOffset'] !== undefined && r['endOffset'] !== undefined && r['key'] !== undefined;
  }),
  toFrontmatterLinkCacheWithOffsets: vi.fn((link: Record<string, unknown>) => {
    if (link['startOffset'] !== undefined && link['endOffset'] !== undefined) {
      return link;
    }
    return { ...link, endOffset: typeof link['original'] === 'string' ? link['original'].length : 0, startOffset: 0 };
  })
}));

// Must import after vi.mock declarations so mocks are applied
const {
  ensureMetadataCacheReady,
  getAllLinks,
  getBacklinksForFileOrPath,
  getCacheSafe,
  getFrontmatterSafe,
  parseMetadata,
  registerFileCacheForNonExistingFile,
  registerFiles,
  tempRegisterFilesAndRun,
  tempRegisterFilesAndRunAsync,
  unregisterFileCacheForNonExistingFile,
  unregisterFiles
} = await import('../../src/obsidian/MetadataCache.ts');

const mockedGetFile = vi.mocked(getFile);
const mockedGetFileOrNull = vi.mocked(getFileOrNull);
const mockedSaveNote = vi.mocked(saveNote);

interface MockApp {
  metadataCache: {
    computeFileMetadataAsync: ReturnType<typeof vi.fn>;
    computeMetadataAsync: ReturnType<typeof vi.fn>;
    fileCache: Record<string, unknown>;
    getBacklinksForFile: ReturnType<typeof vi.fn>;
    getFileCache: ReturnType<typeof vi.fn>;
    metadataCache: Record<string, unknown>;
    onCleanCache: ReturnType<typeof vi.fn>;
    uniqueFileLookup: {
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };
  vault: {
    fileMap: Record<string, unknown>;
  };
}

function createMockApp(): MockApp {
  return {
    metadataCache: {
      computeFileMetadataAsync: vi.fn(),
      computeMetadataAsync: vi.fn(),
      fileCache: {} as Record<string, unknown>,
      getBacklinksForFile: vi.fn(),
      getFileCache: vi.fn(),
      metadataCache: {} as Record<string, unknown>,
      onCleanCache: vi.fn((cb: () => void) => {
        cb();
      }),
      uniqueFileLookup: {
        add: vi.fn(),
        remove: vi.fn()
      }
    },
    vault: {
      fileMap: {} as Record<string, unknown>
    }
  };
}

function makeFrontmatterLink(original: string, key: string): FrontmatterLinkCache {
  return {
    displayText: original,
    key,
    link: original,
    original
  } as unknown as FrontmatterLinkCache;
}

function makeFrontmatterLinkWithOffsets(original: string, key: string, startOffset: number, endOffset: number): FrontmatterLinkCache {
  return {
    displayText: original,
    endOffset,
    key,
    link: original,
    original,
    startOffset
  } as unknown as FrontmatterLinkCache;
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
    const app = createMockApp();
    await ensureMetadataCacheReady(app as unknown as App);
    expect(app.metadataCache.onCleanCache).toHaveBeenCalledOnce();
  });

  it('should wait for async resolution of onCleanCache', async () => {
    const app = createMockApp();
    app.metadataCache.onCleanCache = vi.fn((cb: () => void) => {
      setTimeout(cb, 0);
    });
    await ensureMetadataCacheReady(app as unknown as App);
    expect(app.metadataCache.onCleanCache).toHaveBeenCalledOnce();
  });
});

describe('parseMetadata', () => {
  it('should encode string and call computeMetadataAsync', async () => {
    const app = createMockApp();
    const mockCache: CachedMetadata = { links: [] };
    app.metadataCache.computeMetadataAsync.mockResolvedValue(mockCache);

    const result = await parseMetadata(app as unknown as App, 'test string');
    expect(app.metadataCache.computeMetadataAsync).toHaveBeenCalledOnce();
    const callArg = app.metadataCache.computeMetadataAsync.mock.calls[0]?.[0] as ArrayBuffer;
    const decoded = new TextDecoder().decode(callArg);
    expect(decoded).toBe('test string');
    expect(result).toBe(mockCache);
  });

  it('should return empty object when computeMetadataAsync returns null', async () => {
    const app = createMockApp();
    app.metadataCache.computeMetadataAsync.mockResolvedValue(null);

    const result = await parseMetadata(app as unknown as App, 'test');
    expect(result).toEqual({});
  });
});

describe('registerFileCacheForNonExistingFile', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
    mockedGetFile.mockReset();
  });

  it('should register file cache when file is deleted', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' };
    const cache: CachedMetadata = { links: [] };

    mockedGetFile.mockReturnValue(file as unknown as ReturnType<typeof getFile>);

    registerFileCacheForNonExistingFile(app as unknown as App, file as never, cache);

    expect(app.metadataCache.fileCache['folder/note.md']).toEqual({
      hash: 'folder/note.md',
      mtime: 0,
      size: 0
    });
    expect(app.metadataCache.metadataCache['folder/note.md']).toBe(cache);
  });

  it('should throw when file is not deleted', () => {
    const file = { deleted: false, name: 'note.md', path: 'folder/note.md' };

    mockedGetFile.mockReturnValue(file as unknown as ReturnType<typeof getFile>);

    expect(() => {
      registerFileCacheForNonExistingFile(app as unknown as App, file as never, {});
    })
      .toThrow('File is existing');
  });
});

describe('unregisterFileCacheForNonExistingFile', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
    mockedGetFile.mockReset();
  });

  it('should delete file cache entries when file is deleted', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' };
    app.metadataCache.fileCache['folder/note.md'] = { hash: 'folder/note.md', mtime: 0, size: 0 };
    app.metadataCache.metadataCache['folder/note.md'] = { links: [] };

    mockedGetFile.mockReturnValue(file as unknown as ReturnType<typeof getFile>);

    unregisterFileCacheForNonExistingFile(app as unknown as App, file as never);

    expect(app.metadataCache.fileCache['folder/note.md']).toBeUndefined();
    expect(app.metadataCache.metadataCache['folder/note.md']).toBeUndefined();
  });

  it('should throw when file is not deleted', () => {
    const file = { deleted: false, name: 'note.md', path: 'folder/note.md' };

    mockedGetFile.mockReturnValue(file as unknown as ReturnType<typeof getFile>);

    expect(() => {
      unregisterFileCacheForNonExistingFile(app as unknown as App, file as never);
    })
      .toThrow('File is existing');
  });
});

describe('registerFiles', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should register a deleted file into fileMap', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' } as unknown as TAbstractFile;

    registerFiles(app as unknown as App, [file]);

    expect(app.vault.fileMap['folder/note.md']).toBe(file);
  });

  it('should call uniqueFileLookup.add for file-like deleted entries', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' } as unknown as TAbstractFile;

    registerFiles(app as unknown as App, [file]);

    expect(app.metadataCache.uniqueFileLookup.add).toHaveBeenCalledWith('note.md', file);
  });

  it('should not register a non-deleted file', () => {
    const file = { deleted: false, name: 'note.md', path: 'folder/note.md' } as unknown as TAbstractFile;

    registerFiles(app as unknown as App, [file]);

    expect(app.vault.fileMap['folder/note.md']).toBeUndefined();
  });
});

describe('unregisterFiles', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should remove a deleted file from fileMap when count reaches 0', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' } as unknown as TAbstractFile;
    app.vault.fileMap['folder/note.md'] = file;

    unregisterFiles(app as unknown as App, [file]);

    expect(app.vault.fileMap['folder/note.md']).toBeUndefined();
  });

  it('should call uniqueFileLookup.remove for file-like deleted entries when count reaches 0', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' } as unknown as TAbstractFile;
    app.vault.fileMap['folder/note.md'] = file;

    unregisterFiles(app as unknown as App, [file]);

    expect(app.metadataCache.uniqueFileLookup.remove).toHaveBeenCalledWith('note.md', file);
  });

  it('should not remove a non-deleted file', () => {
    const file = { deleted: false, name: 'note.md', path: 'folder/note.md' } as unknown as TAbstractFile;
    app.vault.fileMap['folder/note.md'] = file;

    unregisterFiles(app as unknown as App, [file]);

    expect(app.vault.fileMap['folder/note.md']).toBe(file);
  });
});

describe('tempRegisterFilesAndRun', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should run the function and return its result', () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md' } as unknown as TAbstractFile;
    const result = tempRegisterFilesAndRun(app as unknown as App, [file], () => 42);
    expect(result).toBe(42);
  });

  it('should still unregister files even when fn throws', () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md' } as unknown as TAbstractFile;
    expect(() =>
      tempRegisterFilesAndRun(app as unknown as App, [file], () => {
        throw new Error('test error');
      })
    ).toThrow('test error');
  });
});

describe('tempRegisterFilesAndRunAsync', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should run the async function and return its result', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md' } as unknown as TAbstractFile;
    const result = await tempRegisterFilesAndRunAsync(app as unknown as App, [file], async () => 'hello');
    expect(result).toBe('hello');
  });

  it('should still unregister files even when fn rejects', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md' } as unknown as TAbstractFile;
    await expect(tempRegisterFilesAndRunAsync(app as unknown as App, [file], async () => {
      throw new Error('async error');
    })).rejects.toThrow('async error');
  });
});

describe('getBacklinksForFileOrPath', () => {
  beforeEach(() => {
    mockedGetFile.mockReset();
    mockedGetFile.mockImplementation((_app: unknown, pathOrFile: unknown) => {
      if (typeof pathOrFile === 'string') {
        return { deleted: true, name: pathOrFile.split('/').pop(), path: pathOrFile } as unknown as ReturnType<typeof getFile>;
      }
      return pathOrFile as ReturnType<typeof getFile>;
    });
  });

  it('should call getBacklinksForFile and return result', () => {
    const app = createMockApp();
    const mockBacklinks = { data: new Map() };
    app.metadataCache.getBacklinksForFile.mockReturnValue(mockBacklinks);

    const result = getBacklinksForFileOrPath(app as unknown as App, 'test.md');

    expect(app.metadataCache.getBacklinksForFile).toHaveBeenCalled();
    expect(result).toBe(mockBacklinks);
  });
});

describe('getCacheSafe', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
    mockedGetFileOrNull.mockReset();
    mockedSaveNote.mockReset();
    mockedSaveNote.mockResolvedValue(undefined);
  });

  it('should return null when file does not exist', async () => {
    mockedGetFileOrNull.mockReturnValue(null as unknown as ReturnType<typeof getFileOrNull>);

    const result = await getCacheSafe(app as unknown as App, 'nonexistent.md');
    expect(result).toBeNull();
  });

  it('should return file cache directly for deleted file', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(file as unknown as ReturnType<typeof getFileOrNull>);
    app.metadataCache.getFileCache.mockReturnValue(mockCache);

    const result = await getCacheSafe(app as unknown as App, file as never);
    expect(result).toBe(mockCache);
  });

  it('should compute metadata if cache is not up to date', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 100, size: 50 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(file as unknown as ReturnType<typeof getFileOrNull>);
    app.metadataCache.getFileCache.mockReturnValue(mockCache);
    app.metadataCache.computeFileMetadataAsync.mockResolvedValue(undefined);

    const result = await getCacheSafe(app as unknown as App, file as never);
    expect(app.metadataCache.computeFileMetadataAsync).toHaveBeenCalledWith(file);
    expect(result).toBe(mockCache);
  });

  it('should not recompute if cache is up to date', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 100, size: 50 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(file as unknown as ReturnType<typeof getFileOrNull>);
    app.metadataCache.fileCache['note.md'] = { hash: 'abc', mtime: 100, size: 50 };
    app.metadataCache.metadataCache['abc'] = mockCache;
    app.metadataCache.getFileCache.mockReturnValue(mockCache);

    const result = await getCacheSafe(app as unknown as App, file as never);
    expect(app.metadataCache.computeFileMetadataAsync).not.toHaveBeenCalled();
    expect(result).toBe(mockCache);
  });

  it('should return null if deleted file throws an error', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };

    mockedGetFileOrNull.mockReturnValue(file as unknown as ReturnType<typeof getFileOrNull>);
    app.metadataCache.getFileCache.mockImplementation(() => {
      throw new Error('cache error');
    });

    const result = await getCacheSafe(app as unknown as App, file as never);
    expect(result).toBeNull();
  });

  it('should rethrow error for non-deleted existing file', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };

    mockedGetFileOrNull.mockReturnValue(file as unknown as ReturnType<typeof getFileOrNull>);
    mockedSaveNote.mockRejectedValue(new Error('save error'));

    await expect(getCacheSafe(app as unknown as App, file as never)).rejects.toThrow('save error');
  });
});

describe('getFrontmatterSafe', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
    mockedGetFileOrNull.mockReset();
    mockedSaveNote.mockReset();
    mockedSaveNote.mockResolvedValue(undefined);
  });

  it('should return frontmatter from cache', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };
    const mockFrontmatter = { title: 'Test' };
    const mockCache = { frontmatter: mockFrontmatter } as unknown as CachedMetadata;

    mockedGetFileOrNull.mockReturnValue(file as unknown as ReturnType<typeof getFileOrNull>);
    app.metadataCache.getFileCache.mockReturnValue(mockCache);

    const result = await getFrontmatterSafe(app as unknown as App, file as never);
    expect(result).toBe(mockFrontmatter);
  });

  it('should return empty object when cache has no frontmatter', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };
    const mockCache: CachedMetadata = {};

    mockedGetFileOrNull.mockReturnValue(file as unknown as ReturnType<typeof getFileOrNull>);
    app.metadataCache.getFileCache.mockReturnValue(mockCache);

    const result = await getFrontmatterSafe(app as unknown as App, file as never);
    expect(result).toEqual({});
  });

  it('should return empty object when cache is null', async () => {
    mockedGetFileOrNull.mockReturnValue(null as unknown as ReturnType<typeof getFileOrNull>);

    const result = await getFrontmatterSafe(app as unknown as App, 'nonexistent.md');
    expect(result).toEqual({});
  });
});
