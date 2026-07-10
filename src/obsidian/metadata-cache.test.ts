import type { CustomArrayDict } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  CachedMetadata,
  FrontmatterLinkCache,
  Reference,
  ReferenceCache,
  TAbstractFile,
  TFolder
} from 'obsidian';

import { CustomArrayDictImpl } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';
import type { RetryWithTimeoutNoticeParams } from './async-with-notice.ts';
import type {
  GetFileOrNullParams,
  GetFileParams,
  GetFolderParams,
  PathOrFile
} from './file-system.ts';
import type { FrontmatterLinkCacheWithOffsets } from './frontmatter-link-cache-with-offsets.ts';
import type { CachedMetadataEx } from './metadata-cache.ts';
import type {
  ParseLinkFrontmatterReference,
  ParseLinkFrontmatterReferenceWithOffsets,
  ParseLinkReference
} from './parse-link.ts';

import { castTo } from '../object-utils.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  assertNonNullable,
  ensureGenericObject
} from '../type-guards.ts';
import { ValueWrapper } from '../value-wrapper.ts';
import { retryWithTimeoutNotice } from './async-with-notice.ts';
import {
  getFile,
  getFileOrNull
} from './file-system.ts';
import { parseFrontmatter } from './frontmatter.ts';
import {
  CachedMetadataExFeature,
  ensureMetadataCacheReady,
  getBacklinksForFileOrPath,
  getBacklinksForFileSafe,
  getCacheSafe,
  getFrontmatterSafe,
  getLinks,
  isCachedMetadataEx,
  parseMetadata,
  registerFileCacheForNonExistingFile,
  registerFiles,
  unregisterFileCacheForNonExistingFile,
  unregisterFiles
} from './metadata-cache.ts';
import {
  parseLink,
  toParseLinkReference
} from './parse-link.ts';
import {
  readSafe,
  saveNote
} from './vault.ts';

interface PathHolder {
  path: string;
}

vi.mock('../obsidian-dev-utils-state.ts', () => ({
  getObsidianDevUtilsState: vi.fn((_key: string, defaultValue: unknown) => ({ value: defaultValue }))
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
  getFile: vi.fn((params: GetFileParams) => {
    const { pathOrFile } = params;
    if (typeof pathOrFile === 'string') {
      return { deleted: true, name: pathOrFile.split('/').pop(), path: pathOrFile };
    }
    return pathOrFile;
  }),
  getFileOrNull: vi.fn((params: GetFileOrNullParams) => {
    const { pathOrFile } = params;
    if (typeof pathOrFile === 'string') {
      return { deleted: false, name: pathOrFile.split('/').pop(), path: pathOrFile, stat: { ctime: 0, mtime: 0, size: 0 } };
    }
    return pathOrFile;
  }),
  getFolder: vi.fn((params: GetFolderParams) => ({ children: [], deleted: false, path: params.pathOrFolder })),
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

vi.mock('@obsidian-typings/obsidian-public-latest/implementations', async (importOriginal) => {
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
      cachedRead: vi.fn(),
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
  };
}

function setVaultEntry(targetApp: App, path: string, value: TAbstractFile): void {
  const fileMap = targetApp.vault.fileMap;
  fileMap[path] = value;
}

describe('isCachedMetadataEx', () => {
  it('should return true when features is present', () => {
    const cache: CachedMetadataEx = { features: [] };
    expect(isCachedMetadataEx(cache)).toBe(true);
  });

  it('should return false when features is absent', () => {
    const cache: CachedMetadata = {};
    expect(isCachedMetadataEx(cache)).toBe(false);
  });
});

describe('getLinks', () => {
  it('should return empty array for empty cache', () => {
    const cache: CachedMetadata = {};
    const result = getLinks({ cache });
    expect(result).toEqual([]);
  });

  it('should return links from cache.links only', () => {
    const link = makeReferenceCache('[[note]]', 0);
    const cache: CachedMetadata = { links: [link] };
    const result = getLinks({ cache });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(link);
  });

  it('should return links from cache.embeds only', () => {
    const embed = makeReferenceCache('![[image.png]]', 10);
    const cache: CachedMetadata = { embeds: [embed] };
    const result = getLinks({ cache });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(embed);
  });

  it('should return links from cache.frontmatterLinks only', () => {
    const fmLink = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = { frontmatterLinks: [fmLink] };
    const result = getLinks({ cache });
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
    const result = getLinks({ cache });
    expect(result).toHaveLength(3);
  });

  it('should deduplicate reference caches with same start offset', () => {
    const link1 = makeReferenceCache('[[note]]', 0);
    const link2 = makeReferenceCache('[[note]]', 0);
    const cache: CachedMetadata = { links: [link1, link2] };
    const result = getLinks({ cache });
    expect(result).toHaveLength(1);
  });

  it('should keep reference caches with different start offsets', () => {
    const link1 = makeReferenceCache('[[note1]]', 0);
    const link2 = makeReferenceCache('[[note2]]', 20);
    const cache: CachedMetadata = { links: [link1, link2] };
    const result = getLinks({ cache });
    expect(result).toHaveLength(2);
  });

  it('should deduplicate frontmatter links with same key and no offsets', () => {
    const fmLink1 = makeFrontmatterLink('note', 'aliases');
    const fmLink2 = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getLinks({ cache });
    expect(result).toHaveLength(1);
  });

  it('should keep frontmatter links with different keys', () => {
    const fmLink1 = makeFrontmatterLink('note1', 'aliases');
    const fmLink2 = makeFrontmatterLink('note2', 'related');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getLinks({ cache });
    expect(result).toHaveLength(2);
  });

  it('should deduplicate frontmatter links with offsets when same key and same startOffset', () => {
    const fmLink1 = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const fmLink2 = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getLinks({ cache });
    expect(result).toHaveLength(1);
  });

  it('should keep frontmatter links with offsets when different startOffsets', () => {
    const fmLink1 = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const fmLink2 = makeFrontmatterLinkWithOffsets('other', 'aliases', 5, 10);
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink1, fmLink2]
    };
    const result = getLinks({ cache });
    expect(result).toHaveLength(2);
  });

  it('should not deduplicate a frontmatter link with offsets against one without offsets for same key', () => {
    const fmLinkWithOffsets = makeFrontmatterLinkWithOffsets('note', 'aliases', 0, 4);
    const fmLinkWithout = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLinkWithOffsets, fmLinkWithout]
    };
    const result = getLinks({ cache });
    expect(result).toHaveLength(2);
  });

  it('should not deduplicate mixed types (reference + frontmatter)', () => {
    const refLink = makeReferenceCache('[[note]]', 0);
    const fmLink = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = {
      frontmatterLinks: [fmLink],
      links: [refLink]
    };
    const result = getLinks({ cache });
    expect(result).toHaveLength(2);
  });
});

describe('getLinks selection', () => {
  it('should exclude references when shouldIncludeReferences is false', () => {
    const link = makeReferenceCache('[[note]]', 0);
    const cache: CachedMetadata = { links: [link] };
    expect(getLinks({ cache, shouldIncludeReferences: false })).toEqual([]);
  });

  it('should exclude embeds when shouldIncludeEmbeds is false', () => {
    const embed = makeReferenceCache('![[image.png]]', 10);
    const cache: CachedMetadata = { embeds: [embed] };
    expect(getLinks({ cache, shouldIncludeEmbeds: false })).toEqual([]);
  });

  it('should exclude frontmatter links when shouldIncludeFrontmatterLinks is false', () => {
    const fmLink = makeFrontmatterLink('note', 'aliases');
    const cache: CachedMetadata = { frontmatterLinks: [fmLink] };
    expect(getLinks({ cache, shouldIncludeFrontmatterLinks: false })).toEqual([]);
  });
});

describe('getLinks external selection', () => {
  const content = '[x](file:///a.txt)';
  const parseLinkResult = parseLink(content);
  assertNonNullable(parseLinkResult);
  const externalLink: ParseLinkReference = toParseLinkReference({ content, parseLinkResult });
  const frontmatterExternalLink: ParseLinkFrontmatterReference = {
    key: 'url',
    link: parseLinkResult.url,
    original: parseLinkResult.raw,
    parseLinkResult
  };
  const multiValueFrontmatterExternalLink: ParseLinkFrontmatterReferenceWithOffsets = {
    endOffset: parseLinkResult.endOffset,
    key: 'urls',
    link: parseLinkResult.url,
    original: parseLinkResult.raw,
    parseLinkResult,
    startOffset: parseLinkResult.startOffset
  };
  const internalParseLinkResult = parseLink('[[note]]');
  assertNonNullable(internalParseLinkResult);
  const multiValueFrontmatterLink: ParseLinkFrontmatterReferenceWithOffsets = {
    endOffset: internalParseLinkResult.endOffset,
    key: 'notes',
    link: internalParseLinkResult.url,
    original: internalParseLinkResult.raw,
    parseLinkResult: internalParseLinkResult,
    startOffset: internalParseLinkResult.startOffset
  };

  it('should include body external links when the feature is present', () => {
    const cache: CachedMetadataEx = {
      externalLinks: [externalLink],
      features: [CachedMetadataExFeature.ExternalLinks]
    };
    expect(getLinks({ cache, shouldIncludeExternalLinks: true })).toContain(externalLink);
  });

  it('should throw for body external links when the feature is absent', () => {
    const cache: CachedMetadataEx = { features: [CachedMetadataExFeature.Native] };
    expect(() => getLinks({ cache, shouldIncludeExternalLinks: true })).toThrow('body external links');
  });

  it('should throw for body external links when the cache is not a CachedMetadataEx', () => {
    expect(() => getLinks({ cache: {}, shouldIncludeExternalLinks: true })).toThrow('body external links');
  });

  it('should include frontmatter external links when the feature is present', () => {
    const cache: CachedMetadataEx = {
      features: [CachedMetadataExFeature.FrontmatterExternalLinks],
      frontmatterExternalLinks: [frontmatterExternalLink]
    };
    expect(getLinks({ cache, shouldIncludeFrontmatterExternalLinks: true })).toContain(frontmatterExternalLink);
  });

  it('should throw for frontmatter external links when the feature is absent', () => {
    const cache: CachedMetadataEx = { features: [CachedMetadataExFeature.Native] };
    expect(() => getLinks({ cache, shouldIncludeFrontmatterExternalLinks: true })).toThrow('frontmatter external links');
  });

  it('should throw for frontmatter external links when the cache is not a CachedMetadataEx', () => {
    expect(() => getLinks({ cache: {}, shouldIncludeFrontmatterExternalLinks: true })).toThrow('frontmatter external links');
  });

  it('should include multi-value frontmatter external links when the feature is present', () => {
    const cache: CachedMetadataEx = {
      features: [CachedMetadataExFeature.MultiValueFrontmatterExternalLinks],
      multiValueFrontmatterExternalLinks: [multiValueFrontmatterExternalLink]
    };
    expect(getLinks({ cache, shouldIncludeMultiValueFrontmatterExternalLinks: true })).toContain(multiValueFrontmatterExternalLink);
  });

  it('should throw for multi-value frontmatter external links when the feature is absent', () => {
    const cache: CachedMetadataEx = { features: [CachedMetadataExFeature.Native] };
    expect(() => getLinks({ cache, shouldIncludeMultiValueFrontmatterExternalLinks: true })).toThrow('multi-value frontmatter external links');
  });

  it('should throw for multi-value frontmatter external links when the cache is not a CachedMetadataEx', () => {
    expect(() => getLinks({ cache: {}, shouldIncludeMultiValueFrontmatterExternalLinks: true })).toThrow('multi-value frontmatter external links');
  });

  it('should include multi-value frontmatter links when the feature is present', () => {
    const cache: CachedMetadataEx = {
      features: [CachedMetadataExFeature.MultiValueFrontmatterLinks],
      multiValueFrontmatterLinks: [multiValueFrontmatterLink]
    };
    expect(getLinks({ cache, shouldIncludeMultiValueFrontmatterLinks: true })).toContain(multiValueFrontmatterLink);
  });

  it('should throw for multi-value frontmatter links when the feature is absent', () => {
    const cache: CachedMetadataEx = { features: [CachedMetadataExFeature.Native] };
    expect(() => getLinks({ cache, shouldIncludeMultiValueFrontmatterLinks: true })).toThrow('multi-value frontmatter links');
  });

  it('should throw for multi-value frontmatter links when the cache is not a CachedMetadataEx', () => {
    expect(() => getLinks({ cache: {}, shouldIncludeMultiValueFrontmatterLinks: true })).toThrow('multi-value frontmatter links');
  });
});

describe('ensureMetadataCacheReady', () => {
  it('should resolve when onCleanCache calls the callback', async () => {
    await ensureMetadataCacheReady(app);
    expect(app.metadataCache.onCleanCache).toHaveBeenCalledOnce();
  });

  it('should wait for async resolution of onCleanCache', async () => {
    app.metadataCache.onCleanCache = vi.fn((cb: () => void) => {
      window.setTimeout(cb, 0);
    });
    await ensureMetadataCacheReady(app);
    expect(app.metadataCache.onCleanCache).toHaveBeenCalledOnce();
  });
});

describe('parseMetadata', () => {
  it('should encode string and call computeMetadataAsync', async () => {
    const mockCache: CachedMetadata = { links: [] };

    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(mockCache);

    const result = await parseMetadata(app, 'test string');
    expect(app.metadataCache.computeMetadataAsync).toHaveBeenCalledOnce();

    const callArg = vi.mocked(app.metadataCache.computeMetadataAsync).mock.calls[0]?.[0];
    assertNonNullable(callArg);
    const decoded = new TextDecoder().decode(callArg);
    expect(decoded).toBe('test string');
    expect(result).toEqual({ ...mockCache, features: [CachedMetadataExFeature.Native] });
  });

  it('should return native cache when computeMetadataAsync returns null', async () => {
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(undefined);

    const result = await parseMetadata(app, 'test');
    expect(result).toEqual({ features: [CachedMetadataExFeature.Native] });
  });

  it('should parse body external links when enabled, skipping frontmatter and internal links', async () => {
    const content = '---\nfile:///fm.txt\n---\n[x](file:///body.txt) [[note]]';
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(castTo<CachedMetadata>({
      frontmatterPosition: { end: { col: 0, line: 2, offset: 23 }, start: { col: 0, line: 0, offset: 0 } }
    }));

    const result = await parseMetadata(app, content, { shouldParseExternalLinks: true });
    expect(result.features).toContain(CachedMetadataExFeature.ExternalLinks);
    expect(result.externalLinks).toHaveLength(1);
    expect(result.externalLinks?.[0]?.link).toBe('file:///body.txt');
  });

  it('should parse body external links when the note has no frontmatter', async () => {
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(castTo<CachedMetadata>({}));

    const result = await parseMetadata(app, '[x](file:///a.txt)', { shouldParseExternalLinks: true });
    expect(result.externalLinks).toHaveLength(1);
    expect(result.externalLinks?.[0]?.link).toBe('file:///a.txt');
  });

  it('should parse single-value frontmatter external links when enabled', async () => {
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(castTo<CachedMetadata>({
      frontmatter: { url: 'file:///a.txt' }
    }));

    const result = await parseMetadata(app, '', { shouldParseFrontmatterExternalLinks: true });
    expect(result.features).toContain(CachedMetadataExFeature.FrontmatterExternalLinks);
    expect(result.frontmatterExternalLinks).toHaveLength(1);
  });

  it('should parse multi-value frontmatter external links when enabled', async () => {
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(castTo<CachedMetadata>({
      frontmatter: { urls: 'file:///a.txt file:///b.txt' }
    }));

    const result = await parseMetadata(app, '', { shouldParseMultiValueFrontmatterExternalLinks: true });
    expect(result.features).toContain(CachedMetadataExFeature.MultiValueFrontmatterExternalLinks);
    expect(result.multiValueFrontmatterExternalLinks).toHaveLength(2);
  });

  it('should parse multi-value frontmatter internal links when enabled', async () => {
    vi.mocked(app.metadataCache.computeMetadataAsync).mockResolvedValue(castTo<CachedMetadata>({
      frontmatter: { notes: '[[a]] [[b]]' }
    }));

    const result = await parseMetadata(app, '', { shouldParseMultiValueFrontmatterLinks: true });
    expect(result.features).toContain(CachedMetadataExFeature.MultiValueFrontmatterLinks);
    expect(result.multiValueFrontmatterLinks).toHaveLength(2);
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

    registerFileCacheForNonExistingFile({ app, cache, pathOrFile: castTo<PathOrFile>(file) });

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
      registerFileCacheForNonExistingFile({ app, cache: {}, pathOrFile: castTo<PathOrFile>(file) });
    })
      .toThrow('File is existing');
  });

  it('should unregister the file cache when the returned disposable is disposed', () => {
    const file = { deleted: true, name: 'note.md', path: 'folder/note.md' };
    const cache: CachedMetadata = { links: [] };

    mockedGetFile.mockReturnValue(castTo<ReturnType<typeof getFile>>(file));

    const disposable = registerFileCacheForNonExistingFile({ app, cache, pathOrFile: castTo<PathOrFile>(file) });
    expect(app.metadataCache.metadataCache['folder/note.md']).toBe(cache);

    disposable[Symbol.dispose]();

    expect(app.metadataCache.fileCache['folder/note.md']).toBeUndefined();
    expect(app.metadataCache.metadataCache['folder/note.md']).toBeUndefined();
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

    unregisterFileCacheForNonExistingFile(app, castTo<PathOrFile>(file));

    expect(app.metadataCache.fileCache['folder/note.md']).toBeUndefined();
    expect(app.metadataCache.metadataCache['folder/note.md']).toBeUndefined();
  });

  it('should throw when file is not deleted', () => {
    const file = { deleted: false, name: 'note.md', path: 'folder/note.md' };

    mockedGetFile.mockReturnValue(castTo<ReturnType<typeof getFile>>(file));

    expect(() => {
      unregisterFileCacheForNonExistingFile(app, castTo<PathOrFile>(file));
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
    expect(app.metadataCache.uniqueFileLookup.add).not.toHaveBeenCalled();
  });

  it('should unregister the files when the returned disposable is disposed', () => {
    const file = strictProxy<TAbstractFile>({ deleted: true, name: 'note.md', path: 'folder/note.md' });

    const disposable = registerFiles(app, [file]);
    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBe(file);

    disposable[Symbol.dispose]();

    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBeNull();
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
    expect(app.metadataCache.uniqueFileLookup.remove).not.toHaveBeenCalled();
  });

  it('should not remove file from fileMap when count is still positive', () => {
    const sharedMap = new Map<string, number>();
    const mockedGetState = vi.mocked(getObsidianDevUtilsState);
    mockedGetState.mockReturnValue(ValueWrapper.of(sharedMap));

    const file = strictProxy<TAbstractFile>({ deleted: true, name: 'note.md', path: 'folder/note.md' });

    registerFiles(app, [file]);
    registerFiles(app, [file]);
    unregisterFiles(app, [file]);

    expect(app.vault.getAbstractFileByPath('folder/note.md')).toBe(file);

    mockedGetState.mockImplementation((_key: string, defaultValue: unknown) => ValueWrapper.of(defaultValue));
  });
});

describe('getBacklinksForFileOrPath', () => {
  beforeEach(() => {
    mockedGetFile.mockReset();
    mockedGetFile.mockImplementation((params: GetFileParams) => {
      const { pathOrFile } = params;
      if (typeof pathOrFile === 'string') {
        return castTo<ReturnType<typeof getFile>>({ deleted: true, name: pathOrFile.split('/').pop(), path: pathOrFile });
      }
      return pathOrFile;
    });
  });

  it('should call getBacklinksForFile and return result', () => {
    const mockBacklinks = { data: new Map() };

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(mockBacklinks as ReturnType<typeof app.metadataCache.getBacklinksForFile>);

    const result = getBacklinksForFileOrPath(app, 'test.md');

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

    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache);

    const result = await getCacheSafe(app, castTo<PathOrFile>(file));
    expect(result).toEqual({ ...mockCache, features: [CachedMetadataExFeature.Native] });
  });

  it('should return null when the file cache is null for a deleted file', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(null);

    const result = await getCacheSafe(app, castTo<PathOrFile>(file));
    expect(result).toBeNull();
  });

  it('should compute metadata if cache is not up to date', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 100, size: 50 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache);
    vi.mocked(app.metadataCache.computeFileMetadataAsync).mockResolvedValue(undefined);

    const result = await getCacheSafe(app, castTo<PathOrFile>(file));

    expect(app.metadataCache.computeFileMetadataAsync).toHaveBeenCalledWith(file);
    expect(result).toEqual({ ...mockCache, features: [CachedMetadataExFeature.Native] });
  });

  it('should not recompute if cache is up to date', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 100, size: 50 } };
    const mockCache: CachedMetadata = { links: [] };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));
    app.metadataCache.fileCache['note.md'] = { hash: 'abc', mtime: 100, size: 50 };
    app.metadataCache.metadataCache['abc'] = mockCache;

    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache);

    const result = await getCacheSafe(app, castTo<PathOrFile>(file));

    expect(app.metadataCache.computeFileMetadataAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ ...mockCache, features: [CachedMetadataExFeature.Native] });
  });

  it('should parse body external links from the read content when enabled', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 100, size: 50 } };
    const mockCache: CachedMetadata = {};

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));
    app.metadataCache.fileCache['note.md'] = { hash: 'abc', mtime: 100, size: 50 };
    app.metadataCache.metadataCache['abc'] = mockCache;
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache);
    vi.mocked(app.vault.cachedRead).mockResolvedValue('[x](file:///a.txt)');

    const result = await getCacheSafe(app, castTo<PathOrFile>(file), { shouldParseExternalLinks: true });

    expect(result?.features).toContain(CachedMetadataExFeature.ExternalLinks);
    expect(result?.externalLinks).toHaveLength(1);
    expect(result?.externalLinks?.[0]?.link).toBe('file:///a.txt');
  });

  it('should return null if deleted file throws an error', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    vi.mocked(app.metadataCache.getFileCache).mockImplementation(() => {
      throw new Error('cache error');
    });

    const result = await getCacheSafe(app, castTo<PathOrFile>(file));
    expect(result).toBeNull();
  });

  it('should rethrow error for non-deleted existing file', async () => {
    const file = { deleted: false, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));
    mockedSaveNote.mockRejectedValue(new Error('save error'));

    await expect(getCacheSafe(app, castTo<PathOrFile>(file))).rejects.toThrow('save error');
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

    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache);

    const result = await getFrontmatterSafe(app, castTo<PathOrFile>(file));
    expect(result).toBe(mockFrontmatter);
  });

  it('should return empty object when cache has no frontmatter', async () => {
    const file = { deleted: true, name: 'note.md', path: 'note.md', stat: { ctime: 0, mtime: 0, size: 0 } };
    const mockCache: CachedMetadata = {};

    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>(file));

    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(mockCache);

    const result = await getFrontmatterSafe(app, castTo<PathOrFile>(file));
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

    mockedGetFile.mockImplementation((params: GetFileParams) => {
      const { pathOrFile } = params;
      if (typeof pathOrFile === 'string') {
        return castTo<ReturnType<typeof getFile>>({ deleted: true, name: pathOrFile.split('/').pop(), path: pathOrFile });
      }
      return pathOrFile;
    });
  });

  it('should use safe overload when available', async () => {
    const mockResult = { get: vi.fn(), keys: vi.fn().mockReturnValue([]) };
    const safeFn = vi.fn().mockResolvedValue(mockResult);

    ensureGenericObject(app.metadataCache.getBacklinksForFile)['safe'] = safeFn;

    const result = await getBacklinksForFileSafe({ app, pathOrFile: 'test.md' });
    expect(safeFn).toHaveBeenCalledWith('test.md');
    expect(result).toBe(mockResult);
  });

  it('should default shouldShowTimeoutNotice to true', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    await getBacklinksForFileSafe({ app, pathOrFile: 'test.md' });

    const callArg = mockedRetryWithTimeoutNotice.mock.calls[0]?.[0] as GenericObject | undefined;
    expect(callArg?.['shouldShowTimeoutNotice']).toBe(true);
  });

  it('should pass shouldShowTimeoutNotice from params', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    await getBacklinksForFileSafe({ app, pathOrFile: 'test.md', shouldShowTimeoutNotice: false });

    const callArg = mockedRetryWithTimeoutNotice.mock.calls[0]?.[0] as GenericObject | undefined;
    expect(callArg?.['shouldShowTimeoutNotice']).toBe(false);
  });

  it('should return backlinks for empty backlinks dict', async () => {
    setupRetryToInvokeOperationFn();
    const backlinksDict = createBacklinksDict({});

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(backlinksDict);

    const result = await getBacklinksForFileSafe({ app, pathOrFile: 'test.md' });
    expect(result).toBe(backlinksDict);
  });

  it('should return false when getFileOrNull returns null for note', async () => {
    setupRetryToInvokeOperationFn();
    const refLink = makeReferenceCache('[[target]]', 10);

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue(null);

    await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
    expect(mockedGetFileOrNull).toHaveBeenCalled();
  });

  it('should return false when readSafe returns null', async () => {
    setupRetryToInvokeOperationFn();
    const refLink = makeReferenceCache('[[target]]', 10);

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue(null);

    await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
    expect(mockedReadSafe).toHaveBeenCalled();
  });

  it('should return false when backlinks.get returns null for note', async () => {
    setupRetryToInvokeOperationFn();
    const backlinksDict = {
      get: (): null => null,
      keys: (): string[] => ['source.md']
    };

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(castTo<ReturnType<typeof app.metadataCache.getBacklinksForFile>>(backlinksDict));
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue('some content');
    mockedParseFrontmatter.mockReturnValue({});

    await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
    expect(mockedParseFrontmatter).toHaveBeenCalled();
  });

  it('should succeed when reference cache link matches content', async () => {
    setupRetryToInvokeOperationFn();
    const content = '0123456789[[target]]more text';
    const refLink = makeReferenceCache('[[target]]', 10);

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue(content);
    mockedParseFrontmatter.mockReturnValue({});

    const result = await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
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

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [refLink] })
    );
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue(content);
    mockedParseFrontmatter.mockReturnValue({});

    await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
    expect(operationResult).toBe(false);
  });

  it('should succeed when frontmatter link matches property value', async () => {
    setupRetryToInvokeOperationFn();
    const fmLink = makeFrontmatterLink('target-note', 'aliases');

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [fmLink] })
    );
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue('---\naliases: target-note\n---');
    mockedParseFrontmatter.mockReturnValue({ aliases: ['target-note'] });

    const result = await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
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

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [fmLink] })
    );
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue('---\naliases: 123\n---');
    mockedParseFrontmatter.mockReturnValue(castTo<ReturnType<typeof parseFrontmatter>>({ aliases: 123 }));

    await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
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

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [fmLink] })
    );
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue('---\naliases: different\n---');
    mockedParseFrontmatter.mockReturnValue(castTo<ReturnType<typeof parseFrontmatter>>({ aliases: 'different-value' }));

    await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
    expect(operationResult).toBe(false);
  });

  it('should return true for links that are neither reference nor frontmatter', async () => {
    setupRetryToInvokeOperationFn();
    const unknownLink = { link: 'something', original: 'something' };

    vi.mocked(app.metadataCache.getBacklinksForFile).mockReturnValue(
      createBacklinksDict({ 'source.md': [unknownLink] })
    );
    mockedGetFileOrNull.mockReturnValue(castTo<ReturnType<typeof getFileOrNull>>({ path: 'source.md' }));
    mockedReadSafe.mockResolvedValue('content');
    mockedParseFrontmatter.mockReturnValue({});

    const result = await getBacklinksForFileSafe({ app, pathOrFile: 'target.md' });
    expect(result.keys()).toEqual(['source.md']);
  });
});
