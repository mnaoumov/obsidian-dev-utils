import type { InternalPlugins } from '@obsidian-typings/obsidian-public-latest';
import type {
  App as AppOriginal,
  CachedMetadata,
  FrontmatterLinkCache,
  Reference,
  TFile as TFileOriginal
} from 'obsidian';

import {
  App,
  TFile
} from 'obsidian-test-mocks/obsidian';
// @vitest-environment jsdom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenerateMarkdownLinkParams } from './link.ts';
import type { CanvasReference } from './reference.ts';
import type { ResourceLockComponent } from './resource-lock.ts';

import { CallbackDisposable } from '../disposable.ts';
import { noop } from '../function.ts';
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  assertNonNullable,
  ensureNonNullable
} from '../type-guards.ts';
import { resolveValue } from '../value-provider.ts';
import { GenerateMarkdownLinkDefaultParamsComponent } from './components/generate-markdown-link-default-params-component.ts';
import {
  applyContentChanges,
  applyFileChanges
} from './file-change.ts';
import {
  convertLink,
  editBacklinks,
  editLinks,
  editLinksInContent,
  extractLinkFile,
  fixFrontmatterMarkdownLinks,
  generateMarkdownLink,
  generateRawMarkdownLink,
  LinkPathStyle,
  LinkStyle,
  shouldResetAlias,
  splitSubpath,
  testAngleBrackets,
  testEmbed,
  testLeadingDot,
  testLeadingSlash,
  testWikilink,
  updateLink,
  updateLinksInContent,
  updateLinksInFile
} from './link.ts';
import {
  getBacklinksForFileSafe,
  getCacheSafe,
  parseMetadata,
  registerFiles
} from './metadata-cache.ts';

vi.mock('../obsidian/metadata-cache.ts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...(original as object),
    getBacklinksForFileSafe: vi.fn(),
    getCacheSafe: vi.fn(),
    parseMetadata: vi.fn(),
    registerFiles: vi.fn()
  };
});

vi.mock('../obsidian/file-change.ts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...(original as object),
    applyContentChanges: vi.fn(),
    applyFileChanges: vi.fn()
  };
});

const resourceLockComponent = strictProxy<ResourceLockComponent>({
  lockForPath: () => ({ [Symbol.dispose]: noop })
});

describe('splitSubpath', () => {
  describe('should return the full link as linkPath when there is no subpath', () => {
    const result = splitSubpath('folder/note');

    it('should set linkPath to the full link', () => {
      expect(result.linkPath).toBe('folder/note');
    });

    it('should set subpath to empty string', () => {
      expect(result.subpath).toBe('');
    });
  });

  describe('should split a link with a heading subpath', () => {
    const result = splitSubpath('note#heading');

    it('should set linkPath to "note"', () => {
      expect(result.linkPath).toBe('note');
    });

    it('should set subpath to "#heading"', () => {
      expect(result.subpath).toBe('#heading');
    });
  });

  describe('should split a link with a nested heading subpath', () => {
    const result = splitSubpath('folder/note#heading#subheading');

    it('should set linkPath to "folder/note"', () => {
      expect(result.linkPath).toBe('folder/note');
    });

    it('should set subpath to "#heading#subheading"', () => {
      expect(result.subpath).toBe('#heading#subheading');
    });
  });

  describe('should handle an empty link', () => {
    const result = splitSubpath('');

    it('should set linkPath to empty string', () => {
      expect(result.linkPath).toBe('');
    });

    it('should set subpath to empty string', () => {
      expect(result.subpath).toBe('');
    });
  });

  describe('should handle a subpath-only link', () => {
    const result = splitSubpath('#heading');

    it('should set linkPath to empty string', () => {
      expect(result.linkPath).toBe('');
    });

    it('should set subpath to "#heading"', () => {
      expect(result.subpath).toBe('#heading');
    });
  });

  describe('should handle a link with a block reference subpath', () => {
    const result = splitSubpath('note#^block-id');

    it('should set linkPath to "note"', () => {
      expect(result.linkPath).toBe('note');
    });

    it('should set subpath to "#^block-id"', () => {
      expect(result.subpath).toBe('#^block-id');
    });
  });
});

describe('generateRawMarkdownLink', () => {
  describe('wikilinks', () => {
    it('should generate a simple wikilink', () => {
      const result = generateRawMarkdownLink({
        isWikilink: true,
        url: 'My Note'
      });
      expect(result).toBe('[[My Note]]');
    });

    it('should generate a wikilink with an alias', () => {
      const result = generateRawMarkdownLink({
        alias: 'display text',
        isWikilink: true,
        url: 'My Note'
      });
      expect(result).toBe('[[My Note|display text]]');
    });

    it('should generate an embed wikilink', () => {
      const result = generateRawMarkdownLink({
        isEmbed: true,
        isWikilink: true,
        url: 'image.png'
      });
      expect(result).toBe('![[image.png]]');
    });

    it('should generate an embed wikilink with an alias', () => {
      const result = generateRawMarkdownLink({
        alias: 'my image',
        isEmbed: true,
        isWikilink: true,
        url: 'image.png'
      });
      expect(result).toBe('![[image.png|my image]]');
    });

    it('should generate a wikilink with a subpath', () => {
      const result = generateRawMarkdownLink({
        isWikilink: true,
        url: 'Note#Heading'
      });
      expect(result).toBe('[[Note#Heading]]');
    });

    it('should not include alias part when alias is undefined', () => {
      const result = generateRawMarkdownLink({
        isWikilink: true,
        url: 'Note'
      });
      expect(result).not.toContain('|');
    });
  });

  describe('markdown links', () => {
    it('should generate a simple markdown link', () => {
      const result = generateRawMarkdownLink({
        alias: 'display',
        isWikilink: false,
        url: 'path/to/note.md'
      });
      expect(result).toBe('[display](path/to/note.md)');
    });

    it('should generate a markdown link with an empty alias', () => {
      const result = generateRawMarkdownLink({
        alias: '',
        isWikilink: false,
        url: 'note.md'
      });
      expect(result).toBe('[](note.md)');
    });

    it('should generate an embed markdown link', () => {
      const result = generateRawMarkdownLink({
        alias: '',
        isEmbed: true,
        isWikilink: false,
        url: 'image.png'
      });
      expect(result).toBe('![](image.png)');
    });

    it('should encode spaces in the URL', () => {
      const result = generateRawMarkdownLink({
        alias: 'link',
        isWikilink: false,
        url: 'path with spaces.md'
      });
      expect(result).toBe('[link](path%20with%20spaces.md)');
    });

    it('should use angle brackets when shouldUseAngleBrackets is true', () => {
      const result = generateRawMarkdownLink({
        alias: 'link',
        isWikilink: false,
        shouldUseAngleBrackets: true,
        url: 'path with spaces.md'
      });
      expect(result).toBe('[link](<path with spaces.md>)');
    });

    it('should escape alias when shouldEscapeAlias is true', () => {
      const result = generateRawMarkdownLink({
        alias: '**bold**',
        isWikilink: false,
        shouldEscapeAlias: true,
        url: 'note.md'
      });
      expect(result).toBe('[\\*\\*bold\\*\\*](note.md)');
    });

    it('should not escape alias when shouldEscapeAlias is false', () => {
      const result = generateRawMarkdownLink({
        alias: '**bold**',
        isWikilink: false,
        shouldEscapeAlias: false,
        url: 'note.md'
      });
      expect(result).toBe('[**bold**](note.md)');
    });

    it('should include title when provided', () => {
      const result = generateRawMarkdownLink({
        alias: 'link',
        isWikilink: false,
        title: 'hover text',
        url: 'note.md'
      });
      expect(result).toBe('[link](note.md "hover text")');
    });

    it('should handle embed markdown link with alias', () => {
      const result = generateRawMarkdownLink({
        alias: 'my image',
        isEmbed: true,
        isWikilink: false,
        url: 'image.png'
      });
      expect(result).toBe('![my image](image.png)');
    });

    it('should default alias to empty string for markdown links', () => {
      const result = generateRawMarkdownLink({
        isWikilink: false,
        url: 'note.md'
      });
      expect(result).toBe('[](note.md)');
    });
  });
});

describe('testWikilink', () => {
  it.each([
    { description: 'a wikilink', expected: true, input: '[[note]]' },
    { description: 'an embed wikilink', expected: true, input: '![[note]]' },
    { description: 'a wikilink with alias', expected: true, input: '[[note|alias]]' },
    { description: 'a markdown link', expected: false, input: '[alias](note.md)' },
    { description: 'an embed markdown link', expected: false, input: '![alt](image.png)' },
    { description: 'plain text', expected: false, input: 'just text' }
  ])('should return $expected for $description', ({ expected, input }) => {
    expect(testWikilink(input)).toBe(expected);
  });
});

describe('testEmbed', () => {
  it.each([
    { description: 'an embed wikilink', expected: true, input: '![[image.png]]' },
    { description: 'an embed markdown link', expected: true, input: '![alt](image.png)' },
    { description: 'a non-embed wikilink', expected: false, input: '[[note]]' },
    { description: 'a non-embed markdown link', expected: false, input: '[alias](note.md)' },
    { description: 'plain text', expected: false, input: 'just text' }
  ])('should return $expected for $description', ({ expected, input }) => {
    expect(testEmbed(input)).toBe(expected);
  });
});

describe('testAngleBrackets', () => {
  it.each([
    { description: 'a markdown link with angle brackets', expected: true, input: '[link](<path with spaces.md>)' },
    { description: 'an embed with angle brackets', expected: true, input: '![alt](<image file.png>)' },
    { description: 'a markdown link without angle brackets', expected: false, input: '[link](path.md)' },
    { description: 'a wikilink', expected: false, input: '[[note]]' },
    { description: 'plain text', expected: false, input: 'just text' }
  ])('should return $expected for $description', ({ expected, input }) => {
    expect(testAngleBrackets(input)).toBe(expected);
  });
});

describe('testLeadingDot', () => {
  it.each([
    { description: 'a wikilink with a leading dot', expected: true, input: '[[./note]]' },
    { description: 'a markdown link with a leading dot', expected: true, input: '[link](./note.md)' },
    { description: 'an embed with a leading dot', expected: true, input: '![[./image.png]]' },
    { description: 'an angle bracket link with leading dot', expected: true, input: '[link](<./path with spaces.md>)' },
    { description: 'an absolute path', expected: false, input: '[[note]]' },
    { description: 'plain text', expected: false, input: 'just text' }
  ])('should return $expected for $description', ({ expected, input }) => {
    expect(testLeadingDot(input)).toBe(expected);
  });
});

describe('testLeadingSlash', () => {
  it.each([
    { description: 'a wikilink with a leading slash', expected: true, input: '[[/note]]' },
    { description: 'a markdown link with a leading slash', expected: true, input: '[link](/note.md)' },
    { description: 'an embed with a leading slash', expected: true, input: '![[/image.png]]' },
    { description: 'an angle bracket link with leading slash', expected: true, input: '[link](</path to note.md>)' },
    { description: 'a relative path', expected: false, input: '[[note]]' },
    { description: 'plain text', expected: false, input: 'just text' }
  ])('should return $expected for $description', ({ expected, input }) => {
    expect(testLeadingSlash(input)).toBe(expected);
  });
});

describe('fixFrontmatterMarkdownLinks', () => {
  describe('should detect a markdown link in frontmatter string and add it to frontmatterLinks', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        source: '[alias](note.md)'
      },
      frontmatterLinks: undefined
    });
    const result = fixFrontmatterMarkdownLinks(cache);

    it('should return true', () => {
      expect(result).toBe(true);
    });

    it('should define frontmatterLinks', () => {
      expect(cache.frontmatterLinks).toBeDefined();
    });

    it('should have 1 frontmatter link', () => {
      assertNonNullable(cache.frontmatterLinks);
      expect(cache.frontmatterLinks.length).toBe(1);
    });

    it('should set the link property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.link).toBe('note.md');
    });

    it('should set the original property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.original).toBe('[alias](note.md)');
    });

    it('should set the displayText property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.displayText).toBe('alias');
    });

    it('should set the key property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.key).toBe('source');
    });
  });

  describe('should return false when frontmatter contains no markdown links', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        title: 'plain text'
      },
      frontmatterLinks: undefined
    });
    const result = fixFrontmatterMarkdownLinks(cache);

    it('should return false', () => {
      expect(result).toBe(false);
    });

    it('should not define frontmatterLinks', () => {
      expect(cache.frontmatterLinks).toBeUndefined();
    });
  });

  it('should ignore wikilinks in frontmatter', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        source: '[[note]]'
      },
      frontmatterLinks: undefined
    });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });

  it('should ignore external URLs in frontmatter', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        source: '[example](https://example.com)'
      },
      frontmatterLinks: undefined
    });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });

  describe('should handle nested objects in frontmatter', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        meta: {
          source: '[alias](note.md)'
        }
      },
      frontmatterLinks: undefined
    });
    const result = fixFrontmatterMarkdownLinks(cache);

    it('should return true', () => {
      expect(result).toBe(true);
    });

    it('should define frontmatterLinks', () => {
      expect(cache.frontmatterLinks).toBeDefined();
    });

    it('should have 1 frontmatter link', () => {
      assertNonNullable(cache.frontmatterLinks);
      expect(cache.frontmatterLinks.length).toBe(1);
    });

    it('should set the key to the nested path', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.key).toBe('meta.source');
    });
  });

  describe('should handle multiple links in different frontmatter properties', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        link1: '[a](file1.md)',
        link2: '[b](file2.md)'
      },
      frontmatterLinks: undefined
    });
    const result = fixFrontmatterMarkdownLinks(cache);

    it('should return true', () => {
      expect(result).toBe(true);
    });

    it('should define frontmatterLinks', () => {
      expect(cache.frontmatterLinks).toBeDefined();
    });

    it('should have 2 frontmatter links', () => {
      assertNonNullable(cache.frontmatterLinks);
      expect(cache.frontmatterLinks.length).toBe(2);
    });
  });

  it('should handle null frontmatter values gracefully', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        nothing: null
      },
      frontmatterLinks: undefined
    });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });

  it('should handle numeric and boolean frontmatter values', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        count: 42,
        enabled: true
      },
      frontmatterLinks: undefined
    });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });

  describe('should handle a markdown link without alias (empty alias)', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        source: '[](note.md)'
      },
      frontmatterLinks: undefined
    });
    const result = fixFrontmatterMarkdownLinks(cache);

    it('should return true', () => {
      expect(result).toBe(true);
    });

    it('should define frontmatterLinks', () => {
      expect(cache.frontmatterLinks).toBeDefined();
    });

    it('should set the link property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.link).toBe('note.md');
    });

    it('should not set displayText when alias is undefined', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.displayText).toBeUndefined();
    });
  });

  describe('should update existing frontmatterLink entry if key already exists', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        source: '[new-alias](new-note.md)'
      },
      frontmatterLinks: [{
        key: 'source',
        link: 'old-note.md',
        original: '[old](old-note.md)'
      }]
    });
    const result = fixFrontmatterMarkdownLinks(cache);

    it('should return true', () => {
      expect(result).toBe(true);
    });

    it('should have 1 frontmatter link', () => {
      assertNonNullable(cache.frontmatterLinks);
      expect(cache.frontmatterLinks.length).toBe(1);
    });

    it('should update the link property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.link).toBe('new-note.md');
    });

    it('should update the original property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.original).toBe('[new-alias](new-note.md)');
    });

    it('should update the displayText property', () => {
      assertNonNullable(cache.frontmatterLinks);
      const firstLink = cache.frontmatterLinks[0];
      assertNonNullable(firstLink);
      expect(firstLink.displayText).toBe('new-alias');
    });
  });

  it('should handle undefined frontmatter gracefully', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({ frontmatter: undefined, frontmatterLinks: undefined });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });
});

describe('generateRawMarkdownLink (additional edge cases)', () => {
  describe('should generate a wikilink with isEmbed false explicitly', () => {
    const result = generateRawMarkdownLink({
      isEmbed: false,
      isWikilink: true,
      url: 'Note'
    });

    it('should generate the correct wikilink', () => {
      expect(result).toBe('[[Note]]');
    });

    it('should not contain embed prefix', () => {
      expect(result).not.toContain('!');
    });
  });

  describe('should generate a markdown link with isEmbed false explicitly', () => {
    const result = generateRawMarkdownLink({
      alias: 'link',
      isEmbed: false,
      isWikilink: false,
      url: 'note.md'
    });

    it('should generate the correct markdown link', () => {
      expect(result).toBe('[link](note.md)');
    });

    it('should not contain embed prefix', () => {
      expect(result).not.toContain('!');
    });
  });

  it('should generate a markdown link with both title and angle brackets', () => {
    const result = generateRawMarkdownLink({
      alias: 'link',
      isWikilink: false,
      shouldUseAngleBrackets: true,
      title: 'hover',
      url: 'path with spaces.md'
    });
    expect(result).toBe('[link](<path with spaces.md> "hover")');
  });

  it('should generate a markdown link with title and escaped alias', () => {
    const result = generateRawMarkdownLink({
      alias: '**bold**',
      isWikilink: false,
      shouldEscapeAlias: true,
      title: 'hover text',
      url: 'note.md'
    });
    expect(result).toBe('[\\*\\*bold\\*\\*](note.md "hover text")');
  });

  it('should generate an embed markdown link with title', () => {
    const result = generateRawMarkdownLink({
      alias: 'img',
      isEmbed: true,
      isWikilink: false,
      title: 'image title',
      url: 'image.png'
    });
    expect(result).toBe('![img](image.png "image title")');
  });

  it('should handle a wikilink with empty string alias (no alias part)', () => {
    const result = generateRawMarkdownLink({
      alias: '',
      isWikilink: true,
      url: 'Note'
    });
    expect(result).toBe('[[Note]]');
  });
});

describe('splitSubpath (additional edge cases)', () => {
  describe('should handle a link with multiple hash symbols in subpath', () => {
    const result = splitSubpath('note#a#b#c');

    it('should set linkPath to "note"', () => {
      expect(result.linkPath).toBe('note');
    });

    it('should set subpath to "#a#b#c"', () => {
      expect(result.subpath).toBe('#a#b#c');
    });
  });

  describe('should handle a link with a trailing hash', () => {
    const result = splitSubpath('note#');

    it('should set linkPath to "note"', () => {
      expect(result.linkPath).toBe('note');
    });

    it('should set subpath to "#"', () => {
      expect(result.subpath).toBe('#');
    });
  });

  describe('should handle only a hash character', () => {
    const result = splitSubpath('#');

    it('should set linkPath to empty string', () => {
      expect(result.linkPath).toBe('');
    });

    it('should set subpath to "#"', () => {
      expect(result.subpath).toBe('#');
    });
  });

  describe('should handle deeply nested folder paths without subpath', () => {
    const result = splitSubpath('a/b/c/d/note');

    it('should set linkPath to the full path', () => {
      expect(result.linkPath).toBe('a/b/c/d/note');
    });

    it('should set subpath to empty string', () => {
      expect(result.subpath).toBe('');
    });
  });
});

describe('app-dependent functions', () => {
  let app: AppOriginal;

  beforeEach(() => {
    vi.clearAllMocks();

    app = (
      App.createConfigured__({
        files: {
          'folder/other.md': '# Other',
          'folder/same.md': '# Same',
          'image.png': '',
          'note.md': '# Note\n[[target]]',
          'target.md': '# Target'
        }
      })
    ).asOriginalType__();

    app.vault.getConfig = vi.fn((key: string) => {
      if (key === 'useMarkdownLinks') {
        return false;
      }
      if (key === 'newLinkFormat') {
        return 'shortest';
      }
      return undefined;
    });

    app.metadataCache.getLinkpathDest = vi.fn((linkpath: string) => {
      const allFiles = app.vault.getAllLoadedFiles();
      return allFiles.filter((f): f is TFileOriginal => f instanceof TFile && (f.basename === linkpath || f.name === linkpath));
    });

    app.internalPlugins = strictProxy<InternalPlugins>({
      getEnabledPluginById: castTo<InternalPlugins['getEnabledPluginById']>(vi.fn(() => ({})))
    });

    vi.mocked(registerFiles).mockReturnValue(new CallbackDisposable({ callback: noop }));
    vi.mocked(getCacheSafe).mockResolvedValue(null);
    vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({}));
    vi.mocked(getBacklinksForFileSafe).mockResolvedValue(strictProxy<Awaited<ReturnType<typeof getBacklinksForFileSafe>>>({
      get: () => null,
      keys: () => []
    }));
    vi.mocked(applyContentChanges).mockImplementation(
      async ({ changesProvider, content }) => {
        if (typeof changesProvider === 'function') {
          await (changesProvider as () => Promise<unknown>)();
        }
        return content;
      }
    );
    vi.mocked(applyFileChanges).mockResolvedValue(undefined);
  });

  describe('extractLinkFile', () => {
    it('should return the file when found by getFirstLinkpathDest', () => {
      const link = { link: 'target', original: '[[target]]' } as Reference;
      const result = extractLinkFile({ app, link, sourcePathOrFile: 'note.md' });
      assertNonNullable(result);
      expect(result.path).toBe('target.md');
    });

    it('should return null when file not found and shouldAllowNonExistingFile is false', () => {
      const link = { link: 'nonexistent', original: '[[nonexistent]]' } as Reference;
      const result = extractLinkFile({ app, link, sourcePathOrFile: 'note.md' });
      expect(result).toBeNull();
    });

    it('should return file for absolute path when shouldAllowNonExistingFile is true', () => {
      const link = { link: '/target.md', original: '[[/target.md]]' } as Reference;
      app.metadataCache.getFirstLinkpathDest = (): null | TFileOriginal => null;
      const result = extractLinkFile({ app, link, shouldAllowNonExistingFile: true, sourcePathOrFile: 'note.md' });
      assertNonNullable(result);
      expect(result.path).toBe('target.md');
    });

    it('should return file for relative path when shouldAllowNonExistingFile is true', () => {
      const link = { link: 'other.md', original: '[[other.md]]' } as Reference;
      app.metadataCache.getFirstLinkpathDest = (): null | TFileOriginal => null;
      const result = extractLinkFile({ app, link, shouldAllowNonExistingFile: true, sourcePathOrFile: 'folder/source.md' });
      assertNonNullable(result);
      expect(result.path).toBe('folder/other.md');
    });

    it('should return null when relative path goes outside vault', () => {
      const link = { link: '../../outside', original: '[[../../outside]]' } as Reference;
      app.metadataCache.getFirstLinkpathDest = (): null | TFileOriginal => null;
      const result = extractLinkFile({ app, link, shouldAllowNonExistingFile: true, sourcePathOrFile: 'note.md' });
      expect(result).toBeNull();
    });
  });

  describe('generateMarkdownLink', () => {
    it('should generate a wikilink with shortest path style', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[target]]');
    });

    it('should generate a wikilink with alias', () => {
      const result = generateMarkdownLink({
        alias: 'my alias',
        app,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[target|my alias]]');
    });

    it('should generate a wikilink where alias matches link text (case-insensitive)', () => {
      const result = generateMarkdownLink({
        alias: 'Target',
        app,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[Target]]');
    });

    it('should generate a markdown link', () => {
      const result = generateMarkdownLink({
        alias: 'display',
        app,
        linkStyle: LinkStyle.Markdown,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[display](target.md)');
    });

    it('should auto-set basename alias for markdown link to markdown file with no alias', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.Markdown,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('[target]');
    });

    it('should auto-set name alias for markdown link to non-markdown file when isEmptyEmbedAliasAllowed is false', () => {
      const result = generateMarkdownLink({
        app,
        isEmptyEmbedAliasAllowed: false,
        linkStyle: LinkStyle.Markdown,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'image.png'
      });
      expect(result).toContain('[image]');
    });

    it('should include attachment extension when shouldIncludeAttachmentExtensionToEmbedAlias is true', () => {
      const result = generateMarkdownLink({
        app,
        isEmptyEmbedAliasAllowed: false,
        linkStyle: LinkStyle.Markdown,
        shouldIncludeAttachmentExtensionToEmbedAlias: true,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'image.png'
      });
      expect(result).toContain('[image.png]');
    });

    it('should generate absolute path with leading slash', () => {
      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.AbsolutePathInVault,
        linkStyle: LinkStyle.Wikilink,
        shouldUseLeadingSlashForAbsolutePaths: true,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[/target]]');
    });

    it('should generate relative path with leading dot', () => {
      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.RelativePathToTheSource,
        linkStyle: LinkStyle.Wikilink,
        shouldUseLeadingDotForRelativePaths: true,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'folder/other.md'
      });
      expect(result).toContain('./');
    });

    it('should use full path when multiple files match shortest name', () => {
      app.metadataCache.getLinkpathDest = vi.fn(() => [
        ensureNonNullable(app.vault.getFileByPath('folder/other.md')),
        ensureNonNullable(app.vault.getFileByPath('folder/same.md'))
      ]);
      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.ShortestPathWhenPossible,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'folder/other.md'
      });
      expect(result).toBe('[[folder/other]]');
    });

    it('should generate self-referential link with subpath only', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'target.md',
        subpath: '#heading',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[#heading]]');
    });

    it('should handle source path as root /', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: '/',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('target');
    });

    it('should use ObsidianSettingsDefault link style (wikilinks)', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.ObsidianSettingsDefault,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[target]]');
    });

    it('should use ObsidianSettingsDefault link style (markdown)', () => {
      app.vault.getConfig = vi.fn((key: string) => {
        if (key === 'useMarkdownLinks') {
          return true;
        }
        if (key === 'newLinkFormat') {
          return 'shortest';
        }
        return undefined;
      });
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.ObsidianSettingsDefault,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('[target]');
    });

    it('should use PreserveExisting link style with wikilink originalLink', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.PreserveExisting,
        originalLink: '[[old]]',
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[target]]');
    });

    it('should use PreserveExisting link style with markdown originalLink', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.PreserveExisting,
        originalLink: '[old](old.md)',
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('(target.md)');
    });

    it('should use PreserveExisting without originalLink (falls back to settings)', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.PreserveExisting,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[target]]');
    });

    it('should infer isEmbed from originalLink', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.Wikilink,
        originalLink: '![[old]]',
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('![[target]]');
    });

    it('should infer angle brackets from originalLink', () => {
      const result = generateMarkdownLink({
        app,
        linkStyle: LinkStyle.Markdown,
        originalLink: '[old](<old file.md>)',
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('<target.md>');
    });

    it('should infer leading dot from originalLink', () => {
      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.RelativePathToTheSource,
        linkStyle: LinkStyle.Wikilink,
        originalLink: '[[./old]]',
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'folder/other.md'
      });
      expect(result).toContain('./');
    });

    it('should infer leading slash from originalLink', () => {
      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.AbsolutePathInVault,
        linkStyle: LinkStyle.Wikilink,
        originalLink: '[[/old]]',
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('/target');
    });

    it('should use ObsidianSettingsDefault link path style with absolute format', () => {
      app.vault.getConfig = vi.fn((key: string) => {
        if (key === 'newLinkFormat') {
          return 'absolute';
        }
        return false;
      });
      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.ObsidianSettingsDefault,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[target]]');
    });

    it('should use ObsidianSettingsDefault link path style with relative format', () => {
      app.vault.getConfig = vi.fn((key: string) => {
        if (key === 'newLinkFormat') {
          return 'relative';
        }
        return false;
      });
      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.ObsidianSettingsDefault,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'folder/other.md'
      });
      expect(result).toContain('other');
    });

    it('should throw for invalid link style', () => {
      expect(() =>
        generateMarkdownLink({
          app,
          linkStyle: 'Invalid' as LinkStyle,
          sourcePathOrFile: 'note.md',
          targetPathOrFile: 'target.md'
        })
      ).toThrow('Unhandled value: Invalid');
    });

    it('should throw for invalid link path style', () => {
      expect(() =>
        generateMarkdownLink({
          app,
          linkPathStyle: 'Invalid' as LinkPathStyle,
          linkStyle: LinkStyle.Wikilink,
          sourcePathOrFile: 'note.md',
          targetPathOrFile: 'target.md'
        })
      ).toThrow('Unhandled value: Invalid');
    });

    it('should throw for invalid ObsidianSettingsDefault new link format', () => {
      app.vault.getConfig = vi.fn((key: string) => {
        if (key === 'newLinkFormat') {
          return 'invalid-format';
        }
        return false;
      });
      expect(() =>
        generateMarkdownLink({
          app,
          linkPathStyle: LinkPathStyle.ObsidianSettingsDefault,
          linkStyle: LinkStyle.Wikilink,
          sourcePathOrFile: 'note.md',
          targetPathOrFile: 'target.md'
        })
      ).toThrow('Unhandled value: invalid-format');
    });

    it('should not allow single subpath when isSingleSubpathAllowed is false', () => {
      const result = generateMarkdownLink({
        app,
        isSingleSubpathAllowed: false,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'target.md',
        subpath: '#heading',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('target');
      expect(result).toContain('#heading');
    });

    it('should handle isNonExistingFileAllowed for non-existing targets', () => {
      const result = generateMarkdownLink({
        app,
        isNonExistingFileAllowed: true,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'nonexistent.md'
      });
      expect(result).toContain('nonexistent');
    });
  });

  describe('shouldResetAlias', () => {
    it('should return false when isWikilink is false', () => {
      const result = shouldResetAlias({
        app,
        displayText: 'any',
        isWikilink: false,
        newSourcePathOrFile: 'note.md',
        oldTargetPath: 'target.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(false);
    });

    it('should return true when displayText is undefined', () => {
      const result = shouldResetAlias({
        app,
        displayText: undefined,
        newSourcePathOrFile: 'note.md',
        oldTargetPath: 'target.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(true);
    });

    it('should return true when displayText matches target path', () => {
      const result = shouldResetAlias({
        app,
        displayText: 'target.md',
        newSourcePathOrFile: 'note.md',
        oldTargetPath: 'target.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(true);
    });

    it('should return true when displayText matches basename without extension', () => {
      const result = shouldResetAlias({
        app,
        displayText: 'target',
        newSourcePathOrFile: 'note.md',
        oldTargetPath: 'target.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(true);
    });

    it('should return false when displayText does not match any alias', () => {
      const result = shouldResetAlias({
        app,
        displayText: 'completely-different-text',
        newSourcePathOrFile: 'note.md',
        oldTargetPath: 'target.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(false);
    });

    it('should handle displayText with separator >', () => {
      const result = shouldResetAlias({
        app,
        displayText: 'target > extra',
        newSourcePathOrFile: 'note.md',
        oldTargetPath: 'target.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(true);
    });

    it('should skip falsy pathOrFile in loop', () => {
      const result = shouldResetAlias({
        app,
        displayText: 'completely-different-text',
        newSourcePathOrFile: 'note.md',
        oldTargetPath: '',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(false);
    });

    it('should use oldSourcePathOrFile when provided', () => {
      const result = shouldResetAlias({
        app,
        displayText: 'target',
        newSourcePathOrFile: 'folder/other.md',
        oldSourcePathOrFile: 'note.md',
        oldTargetPath: 'target.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toBe(true);
    });
  });

  describe('convertLink', () => {
    it('should return original when extractLinkFile returns null', () => {
      const link = {
        displayText: 'nonexistent',
        link: 'nonexistent',
        original: '[[nonexistent]]'
      } as Reference;
      const result = convertLink({
        app,
        link,
        newSourcePathOrFile: 'note.md'
      });
      expect(result).toBe('[[nonexistent]]');
    });

    it('should return updated link when file is found', () => {
      const link = {
        displayText: 'target',
        link: 'target',
        original: '[[target]]'
      } as Reference;
      const result = convertLink({
        app,
        link,
        newSourcePathOrFile: 'note.md'
      });
      expect(result).toContain('target');
    });
  });

  describe('updateLink', () => {
    it('should return original when newTargetPathOrFile is falsy', () => {
      const link = {
        displayText: 'target',
        link: 'target',
        original: '[[target]]'
      } as Reference;
      const result = updateLink({
        app,
        link,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: ''
      });
      expect(result).toBe('[[target]]');
    });

    it('should return path+subpath for canvas file with canvas file node reference', () => {
      const canvasApp = (
        App.createConfigured__({
          files: {
            'canvas.canvas': '{}',
            'target.md': '# Target'
          }
        })
      ).asOriginalType__();
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('canvas.canvas'));
      canvasFile.extension = 'canvas';
      const link = strictProxy<CanvasReference>({
        displayText: 'target',
        isCanvas: true,
        key: 'file',
        link: 'target',
        nodeIndex: 0,
        original: 'target.md',
        type: 'file'
      });
      const result = updateLink({
        app: canvasApp,
        link,
        newSourcePathOrFile: canvasFile,
        newTargetPathOrFile: 'target.md'
      });
      expect(result).toBe('target.md');
    });

    it('should keep wikilink alias when present', () => {
      const link = {
        displayText: 'my alias',
        link: 'target',
        original: '[[target|my alias]]'
      } as Reference;
      const result = updateLink({
        app,
        link,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'target.md'
      });
      expect(result).toBe('[[target|my alias]]');
    });

    it('should update alias matching old basename when shouldUpdateFileNameAlias is not set', () => {
      const link = {
        displayText: 'target',
        link: 'target',
        original: '[[target]]'
      } as Reference;
      const result = updateLink({
        app,
        link,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'folder/other.md',
        oldTargetPathOrFile: 'target.md'
      });
      expect(result).toContain('other');
    });

    it('should update alias matching old name when shouldUpdateFileNameAlias is not set', () => {
      const link = {
        displayText: 'target.md',
        link: 'target',
        original: '[[target]]'
      } as Reference;
      const result = updateLink({
        app,
        link,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'folder/other.md',
        oldTargetPathOrFile: 'target.md'
      });
      expect(result).toContain('other');
    });

    it('should preserve alias when shouldUpdateFileNameAlias is false', () => {
      const link = {
        displayText: 'custom alias',
        link: 'target',
        original: '[[target|custom alias]]'
      } as Reference;
      const result = updateLink({
        app,
        link,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'target.md',
        shouldUpdateFileNameAlias: false
      });
      expect(result).toContain('custom alias');
    });

    it('should use markdown link style', () => {
      const link = {
        displayText: 'target',
        link: 'target',
        original: '[target](target.md)'
      } as Reference;
      const result = updateLink({
        app,
        link,
        linkStyle: LinkStyle.Markdown,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'target.md'
      });
      expect(result).toContain('(target.md)');
    });

    it('should handle subpath in link', () => {
      const link = {
        displayText: 'target',
        link: 'target#heading',
        original: '[[target#heading]]'
      } as Reference;
      const result = updateLink({
        app,
        link,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'target.md'
      });
      expect(result).toContain('#heading');
    });

    it('should remap alias from old basename to new basename when shouldUpdateFileNameAlias is true', () => {
      const link = {
        displayText: 'target',
        link: 'target',
        original: '[target](target.md)'
      } as Reference;
      const result = updateLink({
        app,
        link,
        linkStyle: LinkStyle.Markdown,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'folder/other.md',
        oldTargetPathOrFile: 'target.md',
        shouldUpdateFileNameAlias: true
      });
      expect(result).toContain('[other]');
    });

    it('should remap alias from old name to new name when shouldUpdateFileNameAlias is true', () => {
      const link = {
        displayText: 'target.md',
        link: 'target',
        original: '[target.md](target.md)'
      } as Reference;
      const result = updateLink({
        app,
        link,
        linkStyle: LinkStyle.Markdown,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'folder/other.md',
        oldTargetPathOrFile: 'target.md',
        shouldUpdateFileNameAlias: true
      });
      expect(result).toContain('[other.md]');
    });

    it('should set isSingleSubpathAllowed when old source equals old target and alias exists', () => {
      const link = {
        displayText: 'alias',
        link: 'note#heading',
        original: '[[note#heading|alias]]'
      } as Reference;
      const result = updateLink({
        app,
        link,
        newSourcePathOrFile: 'note.md',
        newTargetPathOrFile: 'note.md',
        oldTargetPathOrFile: 'note.md'
      });
      expect(result).toContain('#heading');
    });
  });

  describe('editLinksInContent', () => {
    it('should process links in content', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }],
        sections: undefined
      }));

      const result = await editLinksInContent({
        app,
        content: '# Note\n[[target]]',
        linkConverter: () => '[[new-target]]'
      });

      expect(result).toBeDefined();
    });

    it('should handle linkConverter returning undefined (skip)', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }],
        sections: undefined
      }));

      const result = await editLinksInContent({
        app,
        content: '[[target]]',
        linkConverter: () => undefined
      });

      expect(result).toBeDefined();
    });

    it('should escape wikilink divider when link is inside a table', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 12, line: 0, offset: 12 }, start: { col: 0, line: 0, offset: 0 } }
        }],
        sections: [{
          position: { end: { col: 50, line: 0, offset: 50 }, start: { col: 0, line: 0, offset: 0 } },
          type: 'table'
        }]
      }));

      const result = await editLinksInContent({
        app,
        content: '| [[target]] |',
        linkConverter: () => '[[new|alias]]'
      });

      expect(result).toBeDefined();
    });

    it('should handle null cache', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>(null));

      const result = await editLinksInContent({
        app,
        content: 'no links',
        linkConverter: () => '[[new]]'
      });

      expect(result).toBeDefined();
    });
  });

  describe('editLinks', () => {
    it('should call applyFileChanges', async () => {
      await editLinks({
        app,
        linkConverter: () => '[[updated]]',
        pathOrFile: 'note.md',
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should invoke changesProvider when applyFileChanges calls it', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: '# Note\n[[target]]' });
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }],
        sections: undefined
      }));

      await editLinks({
        app,
        linkConverter: () => '[[updated]]',
        pathOrFile: 'note.md',
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should return null from changesProvider when content differs from cachedRead', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: 'different content' });
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({}));

      await editLinks({
        app,
        linkConverter: () => '[[updated]]',
        pathOrFile: 'note.md',
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });
  });

  describe('editBacklinks', () => {
    it('should process backlinks and invoke linkConverter for matching links', async () => {
      const backlinkRef = {
        displayText: 'target',
        link: 'target',
        original: '[[target]]',
        position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
      };
      vi.mocked(getBacklinksForFileSafe).mockResolvedValue(strictProxy<Awaited<ReturnType<typeof getBacklinksForFileSafe>>>({
        get: (key: string) => {
          if (key === 'note.md') {
            return [backlinkRef];
          }
          return null;
        },
        keys: () => ['note.md']
      }));

      // Wire up applyFileChanges to invoke changesProvider
      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: '# Note\n[[target]]' });
          }
        }
      );

      // GetCacheSafe returns a cache whose links include the backlink reference
      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [backlinkRef],
        sections: undefined
      }));

      const linkConverter = vi.fn(() => '[[new-target]]');
      await editBacklinks({
        app,
        linkConverter,
        pathOrFile: 'target.md',
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
      expect(linkConverter).toHaveBeenCalled();
    });

    it('should skip links not in backlinks set', async () => {
      const backlinkRef = {
        displayText: 'target',
        link: 'target',
        original: '[[target]]',
        position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
      };
      vi.mocked(getBacklinksForFileSafe).mockResolvedValue(strictProxy<Awaited<ReturnType<typeof getBacklinksForFileSafe>>>({
        get: () => [],
        keys: () => ['note.md']
      }));

      // Wire up applyFileChanges to invoke changesProvider
      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: '# Note\n[[target]]' });
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [backlinkRef],
        sections: undefined
      }));

      const linkConverter = vi.fn(() => '[[new-target]]');
      await editBacklinks({
        app,
        linkConverter,
        pathOrFile: 'target.md',
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
      // LinkConverter should NOT be called because the link is not in the backlinks set
      expect(linkConverter).not.toHaveBeenCalled();
    });
  });

  describe('updateLinksInContent', () => {
    it('should call editLinksInContent with convertLink callback', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({}));

      const result = await updateLinksInContent({
        app,
        content: '# Note\n[[target]]',
        newSourcePathOrFile: 'note.md'
      });

      expect(result).toBeDefined();
    });

    it('should skip non-embed links when shouldUpdateEmbedOnlyLinks is true', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }],
        sections: undefined
      }));

      const result = await updateLinksInContent({
        app,
        content: '[[target]]',
        newSourcePathOrFile: 'note.md',
        shouldUpdateEmbedOnlyLinks: true
      });

      expect(result).toBeDefined();
    });

    it('should invoke convertLink for matching links', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }],
        sections: undefined
      }));

      const result = await updateLinksInContent({
        app,
        content: '[[target]]',
        newSourcePathOrFile: 'note.md'
      });

      expect(result).toBeDefined();
    });
  });

  describe('updateLinksInFile', () => {
    it('should call editLinks for markdown files', async () => {
      await updateLinksInFile({
        app,
        newSourcePathOrFile: 'note.md',
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should return early for canvas files when Canvas plugin is disabled', async () => {
      app.internalPlugins = strictProxy<InternalPlugins>({
        getEnabledPluginById: castTo<InternalPlugins['getEnabledPluginById']>(vi.fn(() => null))
      });

      const canvasApp = (
        App.createConfigured__({
          files: { 'canvas.canvas': '{}' }
        })
      ).asOriginalType__();
      canvasApp.internalPlugins = strictProxy<InternalPlugins>({
        getEnabledPluginById: vi.fn(() => null)
      });
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('canvas.canvas'));
      canvasFile.extension = 'canvas';

      await updateLinksInFile({
        app: canvasApp,
        newSourcePathOrFile: canvasFile,
        resourceLockComponent
      });

      expect(applyFileChanges).not.toHaveBeenCalled();
    });

    it('should skip links when shouldUpdateEmbedOnlyLinks does not match', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: '# Note\n[[target]]' });
          }
        }
      );
      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }],
        sections: undefined
      }));

      await updateLinksInFile({
        app,
        newSourcePathOrFile: 'note.md',
        resourceLockComponent,
        shouldUpdateEmbedOnlyLinks: true
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should invoke convertLink for matching links', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: '# Note\n[[target]]' });
          }
        }
      );
      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }],
        sections: undefined
      }));

      await updateLinksInFile({
        app,
        newSourcePathOrFile: 'note.md',
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });
  });

  describe('GenerateMarkdownLinkDefaultParamsComponent', () => {
    it('should apply registered default params while loaded and stop applying them after unload', () => {
      const component = new GenerateMarkdownLinkDefaultParamsComponent({
        getDefaultParams(): Partial<GenerateMarkdownLinkParams> {
          return {
            shouldUseLeadingSlashForAbsolutePaths: true
          };
        }
      });
      component.load();

      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.AbsolutePathInVault,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('/');

      component.unload();

      const result2 = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.AbsolutePathInVault,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result2).toBe('[[target]]');
    });
  });

  describe('getFileChanges canvas path', () => {
    it('should handle canvas file changes through editLinks', async () => {
      const canvasApp = (
        App.createConfigured__({
          files: {
            'target.md': '# Target',
            'test.canvas': '{"nodes":[]}'
          }
        })
      ).asOriginalType__();
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('test.canvas'));
      canvasFile.extension = 'canvas';

      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: '{"nodes":[]}' });
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: [castTo<FrontmatterLinkCache>({
          isCanvas: true,
          key: 'file',
          link: 'target.md',
          nodeIndex: 0,
          original: 'target.md',
          type: 'file'
        })],
        links: undefined,
        sections: undefined
      }));

      await editLinks({
        app: canvasApp,
        linkConverter: () => 'new-target.md',
        pathOrFile: canvasFile,
        resourceLockComponent
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should log error for non-canvas change in canvas file', async () => {
      const canvasApp = (
        App.createConfigured__({
          files: {
            'target.md': '# Target',
            'test.canvas': '{"nodes":[]}'
          }
        })
      ).asOriginalType__();
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('test.canvas'));
      canvasFile.extension = 'canvas';

      vi.mocked(applyFileChanges).mockImplementation(
        async ({ changesProvider }) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = strictProxy<AbortSignal>({ throwIfAborted: vi.fn() });
            await resolveValue(changesProvider, { abortSignal, content: '{"nodes":[]}' });
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        embeds: undefined,
        frontmatterLinks: undefined,
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }],
        sections: undefined
      }));

      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await editLinks({
        app: canvasApp,
        linkConverter: () => '[[new-target]]',
        pathOrFile: canvasFile,
        resourceLockComponent
      });

      expect(vi.mocked(console.error)).toHaveBeenCalledWith('Unsupported file change', expect.anything());
      vi.mocked(console.error).mockRestore();
    });
  });
});
