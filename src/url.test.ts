import {
  describe,
  expect,
  it
} from 'vitest';

import {
  isFileUrl,
  isUrl,
  normalizeFileUrl
} from './url.ts';

describe('url', () => {
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
      expect(normalizeFileUrl('file:///F:\\dir\\x.txt')).toBe('file:///F:/dir/x.txt');
    });

    it('should leave a file URL with forward slashes unchanged', () => {
      expect(normalizeFileUrl('file:///F:/dir/x.txt')).toBe('file:///F:/dir/x.txt');
    });

    it('should leave a non-file URL unchanged', () => {
      expect(normalizeFileUrl('https://example.com/a\\b')).toBe('https://example.com/a\\b');
    });
  });

  describe('isUrl', () => {
    describe('valid URLs with ://', () => {
      it('should accept http URLs', () => {
        expect(isUrl('http://example.com')).toBe(true);
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
        expect(isUrl('   ')).toBe(false);
      });

      it('should reject URLs with spaces', () => {
        expect(isUrl('http://example .com')).toBe(false);
      });

      it('should reject a URL with a leading space', () => {
        expect(isUrl(' http://example.com')).toBe(false);
      });

      it('should reject a URL with a trailing space', () => {
        expect(isUrl('http://example.com ')).toBe(false);
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
