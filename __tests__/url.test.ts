import {
  describe,
  expect,
  it
} from 'vitest';

import { isUrl } from '../src/url.ts';

describe('url', () => {
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
