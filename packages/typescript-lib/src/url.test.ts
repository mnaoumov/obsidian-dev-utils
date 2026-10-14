import {
  describe,
  expect,
  it
} from 'vitest';

import {
  encodeUrl,
  isFileUrl,
  isUrl,
  normalizeFileUrl,
  pathToFileUrl
} from './url.ts';

describe('url', () => {
  describe('encodeUrl', () => {
    it.each([
      { expected: 'path%20with%20spaces.md', input: 'path with spaces.md' },
      { expected: 'path%5Cto%5Cfile.md', input: String.raw`path\to\file.md` },
      { expected: 'simple-path/file.md', input: 'simple-path/file.md' },
      { expected: '', input: '' },
      { expected: 'a%20b%20c', input: 'a b c' }
    ])('should encode "$input" to "$expected"', ({ expected, input }) => {
      expect(encodeUrl(input)).toBe(expected);
    });

    it.each([
      { description: 'vertical tab', expected: 'path%0Bfile.md', input: 'path\u{B}file.md' },
      { description: 'backspace', expected: 'path%08file.md', input: 'path\u{8}file.md' },
      { description: 'form feed', expected: 'path%0Cfile.md', input: 'path\u{C}file.md' },
      { description: 'null character', expected: 'path%00file.md', input: 'path\u{0}file.md' },
      { description: 'mixed safe and unsafe', expected: 'path/to%20the%5Cfile.md', input: String.raw`path/to the\file.md` }
    ])('should encode $description correctly', ({ expected, input }) => {
      expect(encodeUrl(input)).toBe(expected);
    });

    it('should leave non-ASCII characters unencoded', () => {
      expect(encodeUrl('café/naïve.md')).toBe('café/naïve.md');
    });

    it('should leave a literal percent alone by default', () => {
      expect(encodeUrl('a%20b')).toBe('a%20b');
    });

    it('should leave a literal percent alone when the flag is explicitly off', () => {
      expect(encodeUrl('a%20b', false)).toBe('a%20b');
    });

    it('should encode a literal percent when the flag is on', () => {
      expect(encodeUrl('a%20b', true)).toBe('a%2520b');
    });

    it('should encode a percent alongside the other special symbols when the flag is on', () => {
      expect(encodeUrl(String.raw`a%b c\d`, true)).toBe('a%25b%20c%5Cd');
    });
  });

  describe('pathToFileUrl', () => {
    it('should encode a Windows path with spaces', () => {
      expect(pathToFileUrl(String.raw`C:\a b\c.txt`)).toBe('file:///C:/a%20b/c.txt');
    });

    it('should convert backslashes to forward slashes after encoding', () => {
      expect(pathToFileUrl(String.raw`C:\dir\sub\file.md`)).toBe('file:///C:/dir/sub/file.md');
    });

    it('should collapse the leading slash of a POSIX path', () => {
      expect(pathToFileUrl('/home/user/a b.txt')).toBe('file:///home/user/a%20b.txt');
    });

    it('should collapse every leading slash of a UNC path', () => {
      expect(pathToFileUrl(String.raw`\\server\share\x.txt`)).toBe('file:///server/share/x.txt');
    });

    it('should handle a relative path', () => {
      expect(pathToFileUrl('dir/file.md')).toBe('file:///dir/file.md');
    });

    it('should handle a path with no special characters', () => {
      expect(pathToFileUrl('C:/dir/file.md')).toBe('file:///C:/dir/file.md');
    });

    it('should handle an empty path', () => {
      expect(pathToFileUrl('')).toBe('file:///');
    });

    it('should encode control characters', () => {
      expect(pathToFileUrl('C:/a\u{0}b.txt')).toBe('file:///C:/a%00b.txt');
    });

    it('should leave non-ASCII characters unencoded', () => {
      expect(pathToFileUrl(String.raw`C:\café\naïve.md`)).toBe('file:///C:/café/naïve.md');
    });

    it('should leave a literal percent alone by default', () => {
      expect(pathToFileUrl(String.raw`C:\a%20b\c.txt`)).toBe('file:///C:/a%20b/c.txt');
    });

    it('should encode a literal percent when the flag is on', () => {
      expect(pathToFileUrl(String.raw`C:\a%20b\c.txt`, true)).toBe('file:///C:/a%2520b/c.txt');
    });

    it('should produce a URL the rest of the family agrees is a well-formed file URL', () => {
      const url = pathToFileUrl(String.raw`C:\a b\c.txt`);
      expect(isFileUrl(url)).toBe(true);
      expect(isUrl(url)).toBe(true);
      expect(normalizeFileUrl(url)).toBe(url);
      expect(decodeURIComponent(new URL(url).pathname)).toBe('/C:/a b/c.txt');
    });
  });

  describe('isFileUrl', () => {
    it('should accept a file:// URL', () => {
      expect(isFileUrl('file:///F:/dir/x.txt')).toBe(true);
    });

    it('should accept a file: URL without slashes', () => {
      expect(isFileUrl('file:/F:/dir/x.txt')).toBe(true);
    });

    it('should accept an uppercase FILE scheme', () => {
      expect(isFileUrl('FILE:///F:/dir/x.txt')).toBe(true);
    });

    it('should reject a non-file URL', () => {
      expect(isFileUrl('https://example.com')).toBe(false);
    });

    it('should reject a string that only contains "file" later on', () => {
      expect(isFileUrl('https://example.com/file:')).toBe(false);
    });

    it('should reject a plain path', () => {
      expect(isFileUrl('F:/dir/x.txt')).toBe(false);
    });
  });

  describe('normalizeFileUrl', () => {
    it('should convert backslashes to forward slashes in a file URL', () => {
      expect(normalizeFileUrl(String.raw`file:///F:\dir\x.txt`)).toBe('file:///F:/dir/x.txt');
    });

    it('should leave a file URL with forward slashes unchanged', () => {
      expect(normalizeFileUrl('file:///F:/dir/x.txt')).toBe('file:///F:/dir/x.txt');
    });

    it('should leave a non-file URL unchanged', () => {
      expect(normalizeFileUrl(String.raw`https://example.com/a\b`)).toBe(String.raw`https://example.com/a\b`);
    });
  });

  describe('isUrl', () => {
    describe('valid URLs with ://', () => {
      it('should accept http URLs', () => {
        expect(isUrl('https://example.com')).toBe(true);
      });

      it('should accept https URLs with path', () => {
        expect(isUrl('https://example.com/path')).toBe(true);
      });

      it('should accept https URLs with query and fragment', () => {
        expect(isUrl('https://example.com/path?q=1#frag')).toBe(true);
      });

      it('should accept ftp URLs', () => {
        expect(isUrl('ftp://files.example.com')).toBe(true);
      });

      it('should accept custom scheme URLs with ://', () => {
        expect(isUrl('custom-scheme://foo')).toBe(true);
      });
    });

    describe('valid URLs without ://', () => {
      it('should accept mailto URLs', () => {
        expect(isUrl('mailto:user@host')).toBe(true);
      });

      it('should accept tel URLs', () => {
        expect(isUrl('tel:+1234567890')).toBe(true);
      });

      it('should accept data URLs', () => {
        expect(isUrl('data:text/plain;base64,SGVsbG8=')).toBe(true);
      });
    });

    describe('invalid URLs', () => {
      it('should reject an empty string', () => {
        expect(isUrl('')).toBe(false);
      });

      it('should reject plain text', () => {
        expect(isUrl('hello world')).toBe(false);
      });

      it('should reject strings with only whitespace', () => {
        expect(isUrl(' '.repeat(3))).toBe(false);
      });

      it('should reject URLs with spaces', () => {
        expect(isUrl('http://example .com')).toBe(false);
      });

      it('should reject a URL with a leading space', () => {
        expect(isUrl(' https://example.com')).toBe(false);
      });

      it('should reject a URL with a trailing space', () => {
        expect(isUrl('https://example.com ')).toBe(false);
      });

      it('should reject strings missing a scheme', () => {
        expect(isUrl('example.com')).toBe(false);
      });

      it('should reject relative paths', () => {
        expect(isUrl('./relative/path')).toBe(false);
      });

      it('should reject absolute paths without scheme', () => {
        expect(isUrl('/absolute/path')).toBe(false);
      });

      it('should reject strings with just a colon', () => {
        expect(isUrl(':')).toBe(false);
      });

      it('should reject scheme starting with a digit', () => {
        expect(isUrl('1http://example.com')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should accept a scheme with digits, plus, hyphen, and dot', () => {
        expect(isUrl('coap+tcp://example.com')).toBe(true);
      });

      it('should accept scheme-only with non-whitespace content after colon', () => {
        expect(isUrl('x:something')).toBe(true);
      });

      it('should reject a scheme followed by nothing', () => {
        expect(isUrl('http:')).toBe(false);
      });

      it('should reject a tab character in the URL', () => {
        expect(isUrl('http://example\t.com')).toBe(false);
      });

      it('should reject a newline in the URL', () => {
        expect(isUrl('http://example\n.com')).toBe(false);
      });
    });
  });
});
