// @vitest-environment jsdom
import {
  describe,
  expect,
  it
} from 'vitest';

import { assertNonNullable } from '../type-guards.ts';
import {
  encodeUrl,
  escapeAlias,
  isParseLinkReference,
  parseLink,
  parseLinks,
  toParseLinkReference,
  unescapeAlias
} from './parse-link.ts';

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

      it('should not be a file url', () => {
        assertNonNullable(result);
        expect(result.isFileUrl).toBe(false);
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

    it('should mark an internal link as not a file url', () => {
      const result = parseLink('[link](note.md)');
      assertNonNullable(result);
      expect(result.isFileUrl).toBe(false);
    });

    it('should mark a wikilink as not a file url', () => {
      const result = parseLink('[[note]]');
      assertNonNullable(result);
      expect(result.isFileUrl).toBe(false);
    });

    describe('should parse a file:// URL as a decoded external link', () => {
      const result = parseLink('[doc](file:///F:/dir/My%20Notes/x.txt)');

      it('should not be null', () => {
        expect(result).not.toBeNull();
      });

      it('should be external', () => {
        assertNonNullable(result);
        expect(result.isExternal).toBe(true);
      });

      it('should be a file url', () => {
        assertNonNullable(result);
        expect(result.isFileUrl).toBe(true);
      });

      it('should have the decoded url', () => {
        assertNonNullable(result);
        expect(result.url).toBe('file:///F:/dir/My Notes/x.txt');
      });

      it('should re-encode the url in encodedUrl', () => {
        assertNonNullable(result);
        expect(result.encodedUrl).toBe('file:///F:/dir/My%20Notes/x.txt');
      });
    });

    it('should decode %5C in a file:// URL to a backslash', () => {
      const result = parseLink('[doc](file:///F:/dir/My%5CNotes.txt)');
      assertNonNullable(result);
      expect(result.url).toBe('file:///F:/dir/My\\Notes.txt');
    });

    it('should leave a non-file external URL encoded', () => {
      const result = parseLink('[example](https://example.com/a%20b)');
      assertNonNullable(result);
      expect(result.url).toBe('https://example.com/a%20b');
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

describe('toParseLinkReference', () => {
  it('should map a parsed link to a reference cache with the correct position', () => {
    const content = 'line 0\nline 1 [doc](file:///F:/dir/x.txt) end';
    const parseLinkResult = parseLinks(content).find((parsedLink) => parsedLink.isFileUrl);
    assertNonNullable(parseLinkResult);
    const reference = toParseLinkReference({ content, parseLinkResult });
    expect(reference.link).toBe('file:///F:/dir/x.txt');
    expect(reference.original).toBe('[doc](file:///F:/dir/x.txt)');
    expect(reference.displayText).toBe('doc');
    expect(reference.parseLinkResult).toBe(parseLinkResult);
    expect(reference.position.start.offset).toBe(parseLinkResult.startOffset);
    expect(reference.position.start.line).toBe(1);
    expect(reference.position.start.col).toBe(7);
    expect(reference.position.end.offset).toBe(parseLinkResult.endOffset);
    expect(reference.position.end.line).toBe(1);
  });

  it('should compute a line and column on the first line', () => {
    const content = 'https://example.com';
    const parseLinkResult = parseLink(content);
    assertNonNullable(parseLinkResult);
    const reference = toParseLinkReference({ content, parseLinkResult });
    expect(reference.position.start.line).toBe(0);
    expect(reference.position.start.col).toBe(0);
    expect(reference.displayText).toBeUndefined();
  });
});

describe('isParseLinkReference', () => {
  it('should return true for a parse link reference', () => {
    const content = '[doc](file:///F:/dir/x.txt)';
    const parseLinkResult = parseLink(content);
    assertNonNullable(parseLinkResult);
    expect(isParseLinkReference(toParseLinkReference({ content, parseLinkResult }))).toBe(true);
  });

  it('should return false for a plain reference', () => {
    expect(isParseLinkReference({ link: 'note', original: '[[note]]' })).toBe(false);
  });
});
