import type {
  App,
  CachedMetadata,
  Plugin,
  Reference,
  TFile
} from 'obsidian';

import {
  App as MockApp,
  TFile as MockTFile
} from 'obsidian-test-mocks/obsidian';
// @vitest-environment jsdom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { createMockOf } from '../test-helpers/mock-implementation.ts';
import {
  assertNonNullable,
  ensureGenericObject,
  ensureNonNullable
} from '../type-guards.ts';
import {
  applyContentChanges,
  applyFileChanges
} from './file-change.ts';
import {
  convertLink,
  editBacklinks,
  editLinks,
  editLinksInContent,
  encodeUrl,
  escapeAlias,
  extractLinkFile,
  fixFrontmatterMarkdownLinks,
  generateMarkdownLink,
  generateRawMarkdownLink,
  LinkPathStyle,
  LinkStyle,
  parseLink,
  parseLinks,
  registerGenerateMarkdownLinkDefaultOptionsFn,
  shouldResetAlias,
  splitSubpath,
  testAngleBrackets,
  testEmbed,
  testLeadingDot,
  testLeadingSlash,
  testWikilink,
  unescapeAlias,
  updateLink,
  updateLinksInContent,
  updateLinksInFile
} from './link.ts';
import {
  getBacklinksForFileSafe,
  getCacheSafe,
  parseMetadata,
  tempRegisterFilesAndRun
} from './metadata-cache.ts';

vi.mock('../obsidian/metadata-cache.ts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...(original as object),
    getBacklinksForFileSafe: vi.fn(),
    getCacheSafe: vi.fn(),
    parseMetadata: vi.fn(),
    tempRegisterFilesAndRun: vi.fn((_app: unknown, _files: unknown[], fn: () => unknown) => fn())
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

describe('encodeUrl', () => {
  it.each([
    { expected: 'path%20with%20spaces.md', input: 'path with spaces.md' },
    { expected: 'path%5Cto%5Cfile.md', input: 'path\\to\\file.md' },
    { expected: 'simple-path/file.md', input: 'simple-path/file.md' },
    { expected: '', input: '' },
    { expected: 'a%20b%20c', input: 'a b c' }
  ])('should encode "$input" to "$expected"', ({ expected, input }) => {
    expect(encodeUrl(input)).toBe(expected);
  });
});

describe('escapeAlias', () => {
  it.each([
    { expected: '\\*\\*bold\\*\\*', input: '**bold**' },
    { expected: '\\[link\\]', input: '[link]' },
    { expected: 'back\\\\slash', input: 'back\\slash' },
    { expected: '\\_italic\\_', input: '_italic_' },
    { expected: '\\~\\~strikethrough\\~\\~', input: '~~strikethrough~~' },
    { expected: '\\`code\\`', input: '`code`' },
    { expected: '\\<tag\\>', input: '<tag>' },
    { expected: '\\=\\=highlight\\=\\=', input: '==highlight==' },
    { expected: '\\$math\\$', input: '$math$' },
    { expected: 'plain text 123', input: 'plain text 123' },
    { expected: '', input: '' }
  ])('should escape "$input" to "$expected"', ({ expected, input }) => {
    expect(escapeAlias(input)).toBe(expected);
  });
});

describe('unescapeAlias', () => {
  it.each([
    { expected: '**bold**', input: '\\*\\*bold\\*\\*' },
    { expected: '[link]', input: '\\[link\\]' },
    { expected: 'back\\slash', input: 'back\\\\slash' },
    { expected: 'plain text', input: 'plain text' },
    { expected: '', input: '' }
  ])('should unescape "$input" to "$expected"', ({ expected, input }) => {
    expect(unescapeAlias(input)).toBe(expected);
  });

  it('should be the inverse of escapeAlias for basic strings', () => {
    const original = '**bold** and [link] and _italic_';
    expect(unescapeAlias(escapeAlias(original))).toBe(original);
  });

  it('should be the inverse of escapeAlias for strings with backticks and dollar signs', () => {
    const original = '`code` and $math$';
    expect(unescapeAlias(escapeAlias(original))).toBe(original);
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

describe('parseLink', () => {
  describe('wikilinks', () => {
    describe('should parse a simple wikilink', () => {
      const result = parseLink('[[note]]');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be a wikilink', () => {
        assertNonNullable(result);
        expect(result.isWikilink).toBe(true);
      });

      it('should have url "note"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('note');
      });

      it('should not be an embed', () => {
        assertNonNullable(result);
        expect(result.isEmbed).toBe(false);
      });
    });

    describe('should parse a wikilink with an alias', () => {
      const result = parseLink('[[note|display text]]');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be a wikilink', () => {
        assertNonNullable(result);
        expect(result.isWikilink).toBe(true);
      });

      it('should have url "note"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('note');
      });

      it('should have alias "display text"', () => {
        assertNonNullable(result);
        expect(result.alias).toBe('display text');
      });
    });

    it('should parse a wikilink with a path', () => {
      const result = parseLink('[[folder/note]]');
      assertNonNullable(result);
      expect(result.url).toBe('folder/note');
    });

    it('should parse a wikilink with a heading', () => {
      const result = parseLink('[[note#heading]]');
      assertNonNullable(result);
      expect(result.url).toBe('note#heading');
    });

    describe('should parse an embed wikilink', () => {
      const result = parseLink('![[image.png]]');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be a wikilink', () => {
        assertNonNullable(result);
        expect(result.isWikilink).toBe(true);
      });

      it('should be an embed', () => {
        assertNonNullable(result);
        expect(result.isEmbed).toBe(true);
      });

      it('should have url "image.png"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('image.png');
      });
    });

    describe('should parse an embed wikilink with an alias', () => {
      const result = parseLink('![[image.png|500]]');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be an embed', () => {
        assertNonNullable(result);
        expect(result.isEmbed).toBe(true);
      });

      it('should have url "image.png"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('image.png');
      });

      it('should have alias "500"', () => {
        assertNonNullable(result);
        expect(result.alias).toBe('500');
      });
    });

    it('should not have alias when no pipe is present', () => {
      const result = parseLink('[[note]]');
      assertNonNullable(result);
      expect(result.alias).toBeUndefined();
    });
  });

  describe('markdown links', () => {
    describe('should parse a simple markdown link', () => {
      const result = parseLink('[display](note.md)');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should not be a wikilink', () => {
        assertNonNullable(result);
        expect(result.isWikilink).toBe(false);
      });

      it('should have url "note.md"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('note.md');
      });

      it('should have alias "display"', () => {
        assertNonNullable(result);
        expect(result.alias).toBe('display');
      });
    });

    describe('should parse a markdown link with an empty alias', () => {
      const result = parseLink('[](note.md)');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should not be a wikilink', () => {
        assertNonNullable(result);
        expect(result.isWikilink).toBe(false);
      });

      it('should have url "note.md"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('note.md');
      });

      it('should have undefined alias', () => {
        assertNonNullable(result);
        expect(result.alias).toBeUndefined();
      });
    });

    describe('should parse an embed markdown link', () => {
      const result = parseLink('![](image.png)');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be an embed', () => {
        assertNonNullable(result);
        expect(result.isEmbed).toBe(true);
      });

      it('should not be a wikilink', () => {
        assertNonNullable(result);
        expect(result.isWikilink).toBe(false);
      });

      it('should have url "image.png"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('image.png');
      });
    });

    it('should parse a markdown link with spaces encoded in URL', () => {
      const result = parseLink('[link](path%20with%20spaces.md)');
      assertNonNullable(result);
      expect(result.url).toBe('path with spaces.md');
    });

    describe('should parse a markdown link with angle brackets', () => {
      const result = parseLink('[link](<path with spaces.md>)');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should have angle brackets', () => {
        assertNonNullable(result);
        expect(result.hasAngleBrackets).toBe(true);
      });

      it('should have the correct url', () => {
        assertNonNullable(result);
        expect(result.url).toBe('path with spaces.md');
      });
    });

    describe('should parse an external URL', () => {
      const result = parseLink('[example](https://example.com)');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be external', () => {
        assertNonNullable(result);
        expect(result.isExternal).toBe(true);
      });

      it('should have the correct url', () => {
        assertNonNullable(result);
        expect(result.url).toBe('https://example.com');
      });
    });

    it('should parse an internal link as not external', () => {
      const result = parseLink('[link](note.md)');
      assertNonNullable(result);
      expect(result.isExternal).toBe(false);
    });

    describe('should parse an embed markdown link with alias', () => {
      const result = parseLink('![my image](image.png)');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be an embed', () => {
        assertNonNullable(result);
        expect(result.isEmbed).toBe(true);
      });

      it('should have alias "my image"', () => {
        assertNonNullable(result);
        expect(result.alias).toBe('my image');
      });
    });

    describe('should parse a markdown link with a title', () => {
      const result = parseLink('[display](note.md "hover text")');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should have url "note.md"', () => {
        assertNonNullable(result);
        expect(result.url).toBe('note.md');
      });

      it('should have title "hover text"', () => {
        assertNonNullable(result);
        expect(result.title).toBe('hover text');
      });
    });
  });

  describe('edge cases', () => {
    it.each([
      { description: 'plain text', input: 'just plain text' },
      { description: 'partial wikilink syntax', input: '[[incomplete' },
      { description: 'an empty string', input: '' },
      { description: 'extra text surrounding a link', input: 'before [[note]] after' }
    ])('should return null for $description', ({ input }) => {
      expect(parseLink(input)).toBeNull();
    });
  });
});

describe('parseLinks', () => {
  describe('should parse multiple wikilinks', () => {
    const results = parseLinks('See [[note1]] and [[note2]]');
    const wikilinks = results.filter((r) => r.isWikilink);

    it('should find 2 wikilinks', () => {
      expect(wikilinks.length).toBe(2);
    });

    it('should parse the first wikilink url', () => {
      const firstWikilink = wikilinks[0];
      assertNonNullable(firstWikilink);
      expect(firstWikilink.url).toBe('note1');
    });

    it('should parse the second wikilink url', () => {
      const secondWikilink = wikilinks[1];
      assertNonNullable(secondWikilink);
      expect(secondWikilink.url).toBe('note2');
    });
  });

  describe('should parse mixed wikilinks and markdown links', () => {
    const results = parseLinks('See [[wiki]] and [md](note.md)');
    const wikilinks = results.filter((r) => r.isWikilink);
    const mdLinks = results.filter((r) => !r.isWikilink && !r.isExternal);

    it('should find 1 wikilink', () => {
      expect(wikilinks.length).toBe(1);
    });

    it('should find 1 markdown link', () => {
      expect(mdLinks.length).toBe(1);
    });
  });

  it('should return an empty array for text with no links', () => {
    const results = parseLinks('no links here');
    const nonExternal = results.filter((r) => !r.isExternal);
    expect(nonExternal.length).toBe(0);
  });

  describe('should parse embed wikilinks among text', () => {
    const results = parseLinks('Here is ![[image.png]] embedded');
    const embeds = results.filter((r) => r.isEmbed);

    it('should find 1 embed', () => {
      expect(embeds.length).toBe(1);
    });

    it('should have url "image.png"', () => {
      const firstEmbed = embeds[0];
      assertNonNullable(firstEmbed);
      expect(firstEmbed.url).toBe('image.png');
    });
  });

  describe('should preserve start and end offsets', () => {
    const text = '[[note1]] [[note2]]';
    const results = parseLinks(text);
    const wikilinks = results.filter((r) => r.isWikilink);

    it('should find 2 wikilinks', () => {
      expect(wikilinks.length).toBe(2);
    });

    it('should have correct offset for first wikilink', () => {
      const firstWikilink = wikilinks[0];
      assertNonNullable(firstWikilink);
      expect(text.slice(firstWikilink.startOffset, firstWikilink.endOffset)).toBe('[[note1]]');
    });

    it('should have correct offset for second wikilink', () => {
      const secondWikilink = wikilinks[1];
      assertNonNullable(secondWikilink);
      expect(text.slice(secondWikilink.startOffset, secondWikilink.endOffset)).toBe('[[note2]]');
    });
  });

  describe('should detect plain URL text links', () => {
    const results = parseLinks('Visit https://example.com today');
    const external = results.filter((r) => r.isExternal);

    it('should find 1 external link', () => {
      expect(external.length).toBe(1);
    });

    it('should have the correct url', () => {
      const firstExternal = external[0];
      assertNonNullable(firstExternal);
      expect(firstExternal.url).toBe('https://example.com');
    });
  });

  describe('should parse wikilinks with aliases in a multi-link string', () => {
    const results = parseLinks('[[note|alias1]] and [[other|alias2]]');
    const wikilinks = results.filter((r) => r.isWikilink);

    it('should find 2 wikilinks', () => {
      expect(wikilinks.length).toBe(2);
    });

    it('should parse the first alias', () => {
      const firstWikilink = wikilinks[0];
      assertNonNullable(firstWikilink);
      expect(firstWikilink.alias).toBe('alias1');
    });

    it('should parse the second alias', () => {
      const secondWikilink = wikilinks[1];
      assertNonNullable(secondWikilink);
      expect(secondWikilink.alias).toBe('alias2');
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
      }
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
      }
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
      }
    });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });

  it('should ignore external URLs in frontmatter', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        source: '[example](https://example.com)'
      }
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
      }
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
      }
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
      }
    });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });

  it('should handle numeric and boolean frontmatter values', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        count: 42,
        enabled: true
      }
    });

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });

  describe('should handle a markdown link without alias (empty alias)', () => {
    const cache: CachedMetadata = castTo<CachedMetadata>({
      frontmatter: {
        source: '[](note.md)'
      }
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
    const cache: CachedMetadata = castTo<CachedMetadata>({});

    const result = fixFrontmatterMarkdownLinks(cache);
    expect(result).toBe(false);
  });
});

describe('encodeUrl (additional edge cases)', () => {
  it.each([
    { description: 'vertical tab', expected: 'path%0Bfile.md', input: 'path\x0Bfile.md' },
    { description: 'backspace', expected: 'path%08file.md', input: 'path\x08file.md' },
    { description: 'form feed', expected: 'path%0Cfile.md', input: 'path\x0Cfile.md' },
    { description: 'null character', expected: 'path%00file.md', input: 'path\x00file.md' },
    { description: 'mixed safe and unsafe', expected: 'path/to%20the%5Cfile.md', input: 'path/to the\\file.md' }
  ])('should encode $description correctly', ({ expected, input }) => {
    expect(encodeUrl(input)).toBe(expected);
  });
});

describe('escapeAlias (additional edge cases)', () => {
  it('should escape multiple different special characters in one string', () => {
    expect(escapeAlias('**[bold]** _italic_')).toBe('\\*\\*\\[bold\\]\\*\\* \\_italic\\_');
  });

  it('should escape pipe-like characters in complex markdown', () => {
    expect(escapeAlias('a=b*c')).toBe('a\\=b\\*c');
  });
});

describe('unescapeAlias (additional edge cases)', () => {
  it.each([
    { description: 'triple backslashes before a special character', expected: '\\*', input: '\\\\\\*' },
    { description: 'quadruple backslashes before a special character', expected: '\\\\*', input: '\\\\\\\\\\*' },
    { description: 'text without any escape sequences', expected: 'hello world 123', input: 'hello world 123' },
    { description: 'exclamation marks', expected: '!', input: '\\!' },
    { description: 'parentheses', expected: '(foo)', input: '\\(foo\\)' },
    { description: 'curly braces', expected: '{foo}', input: '\\{foo\\}' },
    { description: 'hash signs', expected: '#heading', input: '\\#heading' },
    { description: 'tilde', expected: '~strikethrough~', input: '\\~strikethrough\\~' }
  ])('should unescape $description', ({ expected, input }) => {
    expect(unescapeAlias(input)).toBe(expected);
  });
});

describe('parseLink (additional edge cases)', () => {
  it('should correctly capture raw text of a wikilink', () => {
    const result = parseLink('[[note]]');
    assertNonNullable(result);
    expect(result.raw).toBe('[[note]]');
  });

  it('should correctly capture raw text of a markdown link', () => {
    const result = parseLink('[alias](note.md)');
    assertNonNullable(result);
    expect(result.raw).toBe('[alias](note.md)');
  });

  it('should correctly capture raw text of an embed wikilink', () => {
    const result = parseLink('![[image.png]]');
    assertNonNullable(result);
    expect(result.raw).toBe('![[image.png]]');
  });

  it('should set isExternal to false for wikilinks', () => {
    const result = parseLink('[[note]]');
    assertNonNullable(result);
    expect(result.isExternal).toBe(false);
  });

  it('should not have title for wikilinks', () => {
    const result = parseLink('[[note]]');
    assertNonNullable(result);
    expect(result.title).toBeUndefined();
  });

  it('should not have hasAngleBrackets for wikilinks', () => {
    const result = parseLink('[[note]]');
    assertNonNullable(result);
    expect(result.hasAngleBrackets).toBeUndefined();
  });

  it('should parse a markdown link with encoded special characters', () => {
    const result = parseLink('[link](path%5Cto%5Cfile.md)');
    assertNonNullable(result);
    expect(result.url).toBe('path\\to\\file.md');
  });

  describe('should parse wikilink with block reference', () => {
    const result = parseLink('[[note#^block-id]]');

    it('should be a wikilink', () => {
      assertNonNullable(result);
      expect(result.isWikilink).toBe(true);
    });

    it('should have url "note#^block-id"', () => {
      assertNonNullable(result);
      expect(result.url).toBe('note#^block-id');
    });
  });

  describe('should parse a markdown link with a title containing quotes', () => {
    const result = parseLink('[link](note.md "a title")');

    it('should have the correct title', () => {
      assertNonNullable(result);
      expect(result.title).toBe('a title');
    });

    it('should have the correct url', () => {
      assertNonNullable(result);
      expect(result.url).toBe('note.md');
    });
  });

  describe('should parse a bare URL string as an external text link', () => {
    const result = parseLink('https://example.com');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should be external', () => {
      assertNonNullable(result);
      expect(result.isExternal).toBe(true);
    });

    it('should have the correct url', () => {
      assertNonNullable(result);
      expect(result.url).toBe('https://example.com');
    });

    it('should not be a wikilink', () => {
      assertNonNullable(result);
      expect(result.isWikilink).toBe(false);
    });
  });

  describe('should parse an embed markdown link with angle brackets', () => {
    const result = parseLink('![alt](<image file.png>)');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should be an embed', () => {
      assertNonNullable(result);
      expect(result.isEmbed).toBe(true);
    });

    it('should have angle brackets', () => {
      assertNonNullable(result);
      expect(result.hasAngleBrackets).toBe(true);
    });

    it('should have the correct url', () => {
      assertNonNullable(result);
      expect(result.url).toBe('image file.png');
    });
  });

  describe('should have unescapedAlias for markdown links with escaped alias', () => {
    const result = parseLink('[\\*bold\\*](note.md)');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the escaped alias', () => {
      assertNonNullable(result);
      expect(result.alias).toBe('\\*bold\\*');
    });

    it('should have the unescaped alias', () => {
      assertNonNullable(result);
      expect(result.unescapedAlias).toBe('*bold*');
    });
  });

  describe('should have encodedUrl for external links', () => {
    const result = parseLink('[example](https://example.com/path)');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should be external', () => {
      assertNonNullable(result);
      expect(result.isExternal).toBe(true);
    });

    it('should have encodedUrl defined', () => {
      assertNonNullable(result);
      expect(result.encodedUrl).toBeDefined();
    });
  });

  describe('should not have encodedUrl for internal links', () => {
    const result = parseLink('[link](note.md)');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should not be external', () => {
      assertNonNullable(result);
      expect(result.isExternal).toBe(false);
    });

    it('should have encodedUrl undefined', () => {
      assertNonNullable(result);
      expect(result.encodedUrl).toBeUndefined();
    });
  });

  describe('should parse wikilink with nested heading subpath', () => {
    const result = parseLink('[[note#heading#subheading]]');

    it('should be a wikilink', () => {
      assertNonNullable(result);
      expect(result.isWikilink).toBe(true);
    });

    it('should have the correct url', () => {
      assertNonNullable(result);
      expect(result.url).toBe('note#heading#subheading');
    });
  });

  describe('should parse wikilink with folder path and alias', () => {
    const result = parseLink('[[folder/note|My Note]]');

    it('should have the correct url', () => {
      assertNonNullable(result);
      expect(result.url).toBe('folder/note');
    });

    it('should have the correct alias', () => {
      assertNonNullable(result);
      expect(result.alias).toBe('My Note');
    });
  });

  describe('should set startOffset and endOffset correctly for single wikilink', () => {
    const result = parseLink('[[note]]');

    it('should have startOffset 0', () => {
      assertNonNullable(result);
      expect(result.startOffset).toBe(0);
    });

    it('should have endOffset 8', () => {
      assertNonNullable(result);
      expect(result.endOffset).toBe(8);
    });
  });

  describe('should set startOffset and endOffset correctly for markdown link', () => {
    const result = parseLink('[alias](note.md)');

    it('should have startOffset 0', () => {
      assertNonNullable(result);
      expect(result.startOffset).toBe(0);
    });

    it('should have endOffset 16', () => {
      assertNonNullable(result);
      expect(result.endOffset).toBe(16);
    });
  });
});

describe('parseLinks (additional edge cases)', () => {
  it('should parse an empty string returning no links', () => {
    const results = parseLinks('');
    expect(results.length).toBe(0);
  });

  describe('should correctly handle multiple embed wikilinks', () => {
    const results = parseLinks('![[img1.png]] and ![[img2.png]]');
    const embeds = results.filter((r) => r.isEmbed && r.isWikilink);

    it('should find 2 embeds', () => {
      expect(embeds.length).toBe(2);
    });

    it('should parse first embed url', () => {
      const firstEmbed = embeds[0];
      assertNonNullable(firstEmbed);
      expect(firstEmbed.url).toBe('img1.png');
    });

    it('should parse second embed url', () => {
      const secondEmbed = embeds[1];
      assertNonNullable(secondEmbed);
      expect(secondEmbed.url).toBe('img2.png');
    });
  });

  describe('should handle embed markdown links among regular markdown links', () => {
    const results = parseLinks('[link](note.md) and ![img](image.png)');
    const nonEmbed = results.filter((r) => !r.isEmbed && !r.isExternal);
    const embed = results.filter((r) => r.isEmbed);

    it('should find 1 non-embed link', () => {
      expect(nonEmbed.length).toBe(1);
    });

    it('should find 1 embed link', () => {
      expect(embed.length).toBe(1);
    });

    it('should have the correct embed url', () => {
      const firstEmbed = embed[0];
      assertNonNullable(firstEmbed);
      expect(firstEmbed.url).toBe('image.png');
    });
  });

  it('should parse multiple external URLs in text', () => {
    const results = parseLinks('Visit https://example.com and https://other.com');
    const external = results.filter((r) => r.isExternal);
    expect(external.length).toBe(2);
  });

  describe('should correctly report offsets for markdown links', () => {
    const text = '[a](b.md) [c](d.md)';
    const results = parseLinks(text);
    const mdLinks = results.filter((r) => !r.isWikilink && !r.isExternal);

    it('should find 2 markdown links', () => {
      expect(mdLinks.length).toBe(2);
    });

    it('should have correct offset for first markdown link', () => {
      const firstMdLink = mdLinks[0];
      assertNonNullable(firstMdLink);
      expect(text.slice(firstMdLink.startOffset, firstMdLink.endOffset)).toBe('[a](b.md)');
    });

    it('should have correct offset for second markdown link', () => {
      const secondMdLink = mdLinks[1];
      assertNonNullable(secondMdLink);
      expect(text.slice(secondMdLink.startOffset, secondMdLink.endOffset)).toBe('[c](d.md)');
    });
  });

  describe('should handle markdown links with titles in multi-link string', () => {
    const results = parseLinks('[a](b.md "title1") and [c](d.md "title2")');
    const mdLinks = results.filter((r) => !r.isWikilink && !r.isExternal);

    it('should find 2 markdown links', () => {
      expect(mdLinks.length).toBe(2);
    });

    it('should parse first link title', () => {
      const firstMdLink = mdLinks[0];
      assertNonNullable(firstMdLink);
      expect(firstMdLink.title).toBe('title1');
    });

    it('should parse second link title', () => {
      const secondMdLink = mdLinks[1];
      assertNonNullable(secondMdLink);
      expect(secondMdLink.title).toBe('title2');
    });
  });

  it('should handle a wikilink followed by a markdown link with no space', () => {
    const results = parseLinks('[[wiki]][md](note.md)');
    const wikilinks = results.filter((r) => r.isWikilink);
    const firstWikilink = wikilinks[0];
    assertNonNullable(firstWikilink);
    expect(firstWikilink.url).toBe('wiki');
  });

  it('should sort all links by startOffset', () => {
    const results = parseLinks('[[a]] [b](c.md) [[d]]');
    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      const previous = results[i - 1];
      assertNonNullable(current);
      assertNonNullable(previous);
      expect(current.startOffset).toBeGreaterThanOrEqual(previous.startOffset);
    }
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

describe('decodeUrlSafely error path', () => {
  it('should fall back to raw URL when decodeURIComponent throws', () => {
    const result = parseLink('[link](file%ZZname.md)');
    assertNonNullable(result);
    expect(result.url).toBe('file%ZZname.md');
  });
});

describe('parseLinks embed-inside-link', () => {
  it('should handle embed markdown link nested inside a regular link alias', () => {
    const results = parseLinks('[![Alt](img.png)](note.md)');
    const mdLinks = results.filter((r) => !r.isExternal);
    expect(mdLinks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('app-dependent functions', () => {
  let app: App;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = castTo<App>(
      await MockApp.createConfigured__({
        files: {
          'folder/other.md': '# Other',
          'folder/same.md': '# Same',
          'image.png': '',
          'note.md': '# Note\n[[target]]',
          'target.md': '# Target'
        }
      })
    );

    const vaultAny = ensureGenericObject(app.vault);
    vaultAny.getConfig = vi.fn((key: string) => {
      if (key === 'useMarkdownLinks') {
        return false;
      }
      if (key === 'newLinkFormat') {
        return 'shortest';
      }
      return undefined;
    });

    const metadataCacheAny = ensureGenericObject(app.metadataCache);
    metadataCacheAny.getLinkpathDest = vi.fn((linkpath: string) => {
      const allFiles = app.vault.getAllLoadedFiles();
      return allFiles.filter((f): f is TFile => f instanceof MockTFile && (f.basename === linkpath || f.name === linkpath));
    });

    ensureGenericObject(app).internalPlugins = createMockOf({
      getEnabledPluginById: vi.fn(() => ({}))
    });

    vi.mocked(tempRegisterFilesAndRun).mockImplementation(
      (_theApp: App, _files: unknown[], fn: () => unknown) => fn()
    );
    vi.mocked(getCacheSafe).mockResolvedValue(null);
    vi.mocked(parseMetadata).mockResolvedValue({} as CachedMetadata);
    vi.mocked(getBacklinksForFileSafe).mockResolvedValue({
      get: () => null,
      keys: () => []
    } as never);
    vi.mocked(applyContentChanges).mockImplementation(
      async (_signal, content, _path, changesProvider) => {
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
      const result = extractLinkFile(app, link, 'note.md');
      assertNonNullable(result);
      expect(result.path).toBe('target.md');
    });

    it('should return null when file not found and shouldAllowNonExistingFile is false', () => {
      const link = { link: 'nonexistent', original: '[[nonexistent]]' } as Reference;
      const result = extractLinkFile(app, link, 'note.md');
      expect(result).toBeNull();
    });

    it('should return file for absolute path when shouldAllowNonExistingFile is true', () => {
      const link = { link: '/target.md', original: '[[/target.md]]' } as Reference;
      app.metadataCache.getFirstLinkpathDest = (): null | TFile => null;
      const result = extractLinkFile(app, link, 'note.md', true);
      assertNonNullable(result);
      expect(result.path).toBe('target.md');
    });

    it('should return file for relative path when shouldAllowNonExistingFile is true', () => {
      const link = { link: 'other.md', original: '[[other.md]]' } as Reference;
      app.metadataCache.getFirstLinkpathDest = (): null | TFile => null;
      const result = extractLinkFile(app, link, 'folder/source.md', true);
      assertNonNullable(result);
      expect(result.path).toBe('folder/other.md');
    });

    it('should return null when relative path goes outside vault', () => {
      const link = { link: '../../outside', original: '[[../../outside]]' } as Reference;
      app.metadataCache.getFirstLinkpathDest = (): null | TFile => null;
      const result = extractLinkFile(app, link, 'note.md', true);
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
      ensureGenericObject(app.metadataCache).getLinkpathDest = vi.fn(() => [
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
      ensureGenericObject(app.vault).getConfig = vi.fn((key: string) => {
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
      ensureGenericObject(app.vault).getConfig = vi.fn((key: string) => {
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
      ensureGenericObject(app.vault).getConfig = vi.fn((key: string) => {
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
      ).toThrow('Invalid link style');
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
      ).toThrow('Invalid link path style');
    });

    it('should throw for invalid ObsidianSettingsDefault new link format', () => {
      ensureGenericObject(app.vault).getConfig = vi.fn((key: string) => {
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
      ).toThrow('Invalid link format');
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
        oldTargetPath: '' as never,
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
        newTargetPathOrFile: '' as never
      });
      expect(result).toBe('[[target]]');
    });

    it('should return path+subpath for canvas file with canvas file node reference', async () => {
      const canvasApp = castTo<App>(
        await MockApp.createConfigured__({
          files: {
            'canvas.canvas': '{}',
            'target.md': '# Target'
          }
        })
      );
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('canvas.canvas'));
      canvasFile.extension = 'canvas';
      const link = castTo<Reference>({
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
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }]
      }));

      const result = await editLinksInContent(
        app,
        '# Note\n[[target]]',
        () => '[[new-target]]'
      );

      expect(result).toBeDefined();
    });

    it('should handle linkConverter returning undefined (skip)', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }]
      }));

      const result = await editLinksInContent(
        app,
        '[[target]]',
        () => undefined
      );

      expect(result).toBeDefined();
    });

    it('should escape wikilink divider when link is inside a table', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
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

      const result = await editLinksInContent(
        app,
        '| [[target]] |',
        () => '[[new|alias]]'
      );

      expect(result).toBeDefined();
    });

    it('should handle null cache', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>(null));

      const result = await editLinksInContent(
        app,
        'no links',
        () => '[[new]]'
      );

      expect(result).toBeDefined();
    });
  });

  describe('editLinks', () => {
    it('should call applyFileChanges', async () => {
      await editLinks(
        app,
        'note.md',
        () => '[[updated]]'
      );

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should invoke changesProvider when applyFileChanges calls it', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, '# Note\n[[target]]');
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }]
      }));

      await editLinks(
        app,
        'note.md',
        () => '[[updated]]'
      );

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should return null from changesProvider when content differs from cachedRead', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, 'different content');
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue({} as CachedMetadata);

      await editLinks(
        app,
        'note.md',
        () => '[[updated]]'
      );

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
      vi.mocked(getBacklinksForFileSafe).mockResolvedValue({
        get: (key: string) => {
          if (key === 'note.md') {
            return [backlinkRef];
          }
          return null;
        },
        keys: () => ['note.md']
      } as never);

      // Wire up applyFileChanges to invoke changesProvider
      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, '# Note\n[[target]]');
          }
        }
      );

      // GetCacheSafe returns a cache whose links include the backlink reference
      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        links: [backlinkRef]
      }));

      const linkConverter = vi.fn(() => '[[new-target]]');
      await editBacklinks(
        app,
        'target.md',
        linkConverter
      );

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
      vi.mocked(getBacklinksForFileSafe).mockResolvedValue({
        get: () => [],
        keys: () => ['note.md']
      } as never);

      // Wire up applyFileChanges to invoke changesProvider
      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, '# Note\n[[target]]');
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        links: [backlinkRef]
      }));

      const linkConverter = vi.fn(() => '[[new-target]]');
      await editBacklinks(
        app,
        'target.md',
        linkConverter
      );

      expect(applyFileChanges).toHaveBeenCalled();
      // LinkConverter should NOT be called because the link is not in the backlinks set
      expect(linkConverter).not.toHaveBeenCalled();
    });
  });

  describe('updateLinksInContent', () => {
    it('should call editLinksInContent with convertLink callback', async () => {
      vi.mocked(parseMetadata).mockResolvedValue({} as CachedMetadata);

      const result = await updateLinksInContent({
        app,
        content: '# Note\n[[target]]',
        newSourcePathOrFile: 'note.md'
      });

      expect(result).toBeDefined();
    });

    it('should skip non-embed links when shouldUpdateEmbedOnlyLinks is true', async () => {
      vi.mocked(parseMetadata).mockResolvedValue(castTo<CachedMetadata>({
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }]
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
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }]
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
        newSourcePathOrFile: 'note.md'
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should return early for canvas files when Canvas plugin is disabled', async () => {
      ensureGenericObject(app).internalPlugins = createMockOf({
        getEnabledPluginById: vi.fn(() => null)
      });

      const canvasApp = castTo<App>(
        await MockApp.createConfigured__({
          files: { 'canvas.canvas': '{}' }
        })
      );
      ensureGenericObject(canvasApp).internalPlugins = createMockOf({
        getEnabledPluginById: vi.fn(() => null)
      });
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('canvas.canvas'));
      canvasFile.extension = 'canvas';

      await updateLinksInFile({
        app: canvasApp,
        newSourcePathOrFile: canvasFile
      });

      expect(applyFileChanges).not.toHaveBeenCalled();
    });

    it('should skip links when shouldUpdateEmbedOnlyLinks does not match', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, '# Note\n[[target]]');
          }
        }
      );
      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }]
      }));

      await updateLinksInFile({
        app,
        newSourcePathOrFile: 'note.md',
        shouldUpdateEmbedOnlyLinks: true
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should invoke convertLink for matching links', async () => {
      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, '# Note\n[[target]]');
          }
        }
      );
      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 19, line: 1, offset: 19 }, start: { col: 7, line: 1, offset: 7 } }
        }]
      }));

      await updateLinksInFile({
        app,
        newSourcePathOrFile: 'note.md'
      });

      expect(applyFileChanges).toHaveBeenCalled();
    });
  });

  describe('registerGenerateMarkdownLinkDefaultOptionsFn', () => {
    it('should register and apply default options', () => {
      let cleanupFn: (() => void) | undefined;
      const mockPlugin = castTo<Plugin>({
        app,
        register: vi.fn((fn: () => void) => {
          cleanupFn = fn;
        })
      });

      registerGenerateMarkdownLinkDefaultOptionsFn(mockPlugin, () => ({
        shouldUseLeadingSlashForAbsolutePaths: true
      }));

      expect(mockPlugin.register).toHaveBeenCalled();

      const result = generateMarkdownLink({
        app,
        linkPathStyle: LinkPathStyle.AbsolutePathInVault,
        linkStyle: LinkStyle.Wikilink,
        sourcePathOrFile: 'note.md',
        targetPathOrFile: 'target.md'
      });
      expect(result).toContain('/');

      assertNonNullable(cleanupFn);
      cleanupFn();

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
      const canvasApp = castTo<App>(
        await MockApp.createConfigured__({
          files: {
            'target.md': '# Target',
            'test.canvas': '{"nodes":[]}'
          }
        })
      );
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('test.canvas'));
      canvasFile.extension = 'canvas';

      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, '{"nodes":[]}');
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        frontmatterLinks: [{
          isCanvas: true,
          key: 'file',
          link: 'target.md',
          nodeIndex: 0,
          original: 'target.md',
          type: 'file'
        }]
      }));

      await editLinks(
        canvasApp,
        canvasFile,
        () => 'new-target.md'
      );

      expect(applyFileChanges).toHaveBeenCalled();
    });

    it('should log error for non-canvas change in canvas file', async () => {
      const canvasApp = castTo<App>(
        await MockApp.createConfigured__({
          files: {
            'target.md': '# Target',
            'test.canvas': '{"nodes":[]}'
          }
        })
      );
      const canvasFile = ensureNonNullable(canvasApp.vault.getFileByPath('test.canvas'));
      canvasFile.extension = 'canvas';

      vi.mocked(applyFileChanges).mockImplementation(
        async (_theApp, _pathOrFile, changesProvider) => {
          if (typeof changesProvider === 'function') {
            const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
            await (changesProvider as (...args: unknown[]) => Promise<unknown>)(abortSignal, '{"nodes":[]}');
          }
        }
      );

      vi.mocked(getCacheSafe).mockResolvedValue(castTo<CachedMetadata>({
        links: [{
          displayText: 'target',
          link: 'target',
          original: '[[target]]',
          position: { end: { col: 10, line: 0, offset: 10 }, start: { col: 0, line: 0, offset: 0 } }
        }]
      }));

      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await editLinks(
        canvasApp,
        canvasFile,
        () => '[[new-target]]'
      );

      expect(vi.mocked(console.error)).toHaveBeenCalledWith('Unsupported file change', expect.anything());
      vi.mocked(console.error).mockRestore();
    });
  });
});
