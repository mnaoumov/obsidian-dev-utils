import {
  describe,
  expect,
  it
} from 'vitest';

import {
  basename,
  dirname,
  extname,
  getFileName,
  getFolderName,
  isAbsolute,
  join,
  makeFileName,
  normalizeIfRelative,
  resolve,
  toPosixBuffer,
  toPosixPath
} from '../src/path.ts';

describe('toPosixPath', () => {
  it('should replace backslashes with forward slashes', () => {
    expect(toPosixPath('foo\\bar\\baz')).toBe('foo/bar/baz');
  });

  it('should handle mixed separators', () => {
    expect(toPosixPath('foo/bar\\baz')).toBe('foo/bar/baz');
  });

  it('should leave already-posix paths unchanged', () => {
    expect(toPosixPath('foo/bar/baz')).toBe('foo/bar/baz');
  });

  it('should handle empty string', () => {
    expect(toPosixPath('')).toBe('');
  });

  it('should handle Windows-style absolute path', () => {
    expect(toPosixPath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
  });
});

describe('toPosixBuffer', () => {
  it('should convert buffer with backslashes to posix-style', () => {
    const input = Buffer.from('foo\\bar\\baz');
    const result = toPosixBuffer(input);
    expect(result.toString()).toBe('foo/bar/baz');
  });

  it('should leave already-posix buffer unchanged', () => {
    const input = Buffer.from('foo/bar/baz');
    const result = toPosixBuffer(input);
    expect(result.toString()).toBe('foo/bar/baz');
  });

  it('should return a Buffer instance', () => {
    const input = Buffer.from('test\\path');
    const result = toPosixBuffer(input);
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

describe('isAbsolute', () => {
  it.each([
    ['/foo'],
    ['/foo/bar'],
    ['/']
  ])('should return true for POSIX absolute path %s', (path: string) => {
    expect(isAbsolute(path)).toBe(true);
  });

  it.each([
    ['foo'],
    ['foo/bar'],
    ['./foo'],
    ['../foo']
  ])('should return false for relative path %s', (path: string) => {
    expect(isAbsolute(path)).toBe(false);
  });

  it.each([
    ['C:/path/to/file'],
    ['c:/path'],
    ['D:/something']
  ])('should return true for Windows-style drive path %s', (path: string) => {
    expect(isAbsolute(path)).toBe(true);
  });

  it('should return false for invalid Windows-style paths with extra colons', () => {
    // The regex /[a-zA-Z]:\/[^:]*$/ requires no colons after the drive prefix
    expect(isAbsolute('C:/path:invalid')).toBe(false);
  });
});

describe('makeFileName', () => {
  it.each([
    ['document', 'txt', 'document.txt'],
    ['image', 'png', 'image.png']
  ])('should append extension: makeFileName(%s, %s) -> %s', (name: string, ext: string, expected: string) => {
    expect(makeFileName(name, ext)).toBe(expected);
  });

  it('should return just the base name when extension is empty', () => {
    expect(makeFileName('document', '')).toBe('document');
  });

  it('should not add a leading dot to the extension', () => {
    // If extension already has a dot, it will appear as name..ext
    expect(makeFileName('file', '.txt')).toBe('file..txt');
  });
});

describe('normalizeIfRelative', () => {
  it('should prepend ./ to a relative path', () => {
    expect(normalizeIfRelative('foo/bar')).toBe('./foo/bar');
  });

  it('should not modify a path already starting with ./', () => {
    expect(normalizeIfRelative('./foo/bar')).toBe('./foo/bar');
  });

  it('should not modify absolute paths starting with /', () => {
    expect(normalizeIfRelative('/foo/bar')).toBe('/foo/bar');
  });

  it.each([
    ['C:/foo/bar', 'C:/foo/bar'],
    ['scheme:something', 'scheme:something']
  ])('should not modify path containing a colon: %s', (input: string, expected: string) => {
    expect(normalizeIfRelative(input)).toBe(expected);
  });

  it('should handle a simple filename', () => {
    expect(normalizeIfRelative('file.txt')).toBe('./file.txt');
  });
});

describe('resolve', () => {
  it('should resolve a path to the expected value', () => {
    const result = resolve('/foo', 'bar', 'baz');
    expect(result).toBe('/foo/bar/baz');
  });

  it('should return posix-style paths without backslashes', () => {
    const result = resolve('/foo', 'bar', 'baz');
    expect(result).not.toContain('\\');
  });

  it('should resolve relative segments', () => {
    const result = resolve('/foo/bar', '../baz');
    expect(result).toBe('/foo/baz');
  });
});

describe('getFileName', () => {
  it('should extract a POSIX-style file path from a file URL', () => {
    const result = getFileName('file:///foo/bar/baz.ts');
    expect(result).toBe('/foo/bar/baz.ts');
  });

  it('should decode URI-encoded characters', () => {
    const result = getFileName('file:///foo/bar%20baz/file.ts');
    expect(result).toBe('/foo/bar baz/file.ts');
  });
});

describe('getFolderName', () => {
  it('should return the directory of the file URL', () => {
    const result = getFolderName('file:///foo/bar/baz.ts');
    expect(result).toBe('/foo/bar');
  });

  it('should decode URI-encoded characters in folder path', () => {
    const result = getFolderName('file:///foo/bar%20baz/file.ts');
    expect(result).toBe('/foo/bar baz');
  });
});

describe('re-exported path-browserify functions', () => {
  describe('basename', () => {
    it.each([
      ['/foo/bar/baz.txt', undefined, 'baz.txt'],
      ['/foo/bar/baz.txt', '.txt', 'baz']
    ])('should return the last portion of path %s with ext %s -> %s', (path: string, ext: string | undefined, expected: string) => {
      expect(basename(path, ext)).toBe(expected);
    });
  });

  describe('dirname', () => {
    it.each([
      ['/foo/bar/baz.txt', '/foo/bar'],
      ['/foo/bar', '/foo']
    ])('should return the directory name of %s -> %s', (path: string, expected: string) => {
      expect(dirname(path)).toBe(expected);
    });
  });

  describe('extname', () => {
    it.each([
      ['file.txt', '.txt'],
      ['file.tar.gz', '.gz'],
      ['noext', '']
    ])('should return the file extension of %s -> %s', (path: string, expected: string) => {
      expect(extname(path)).toBe(expected);
    });
  });

  describe('join', () => {
    it.each([
      [['foo', 'bar', 'baz'], 'foo/bar/baz'],
      [['/foo', 'bar', '../baz'], '/foo/baz']
    ])('should join path segments %j -> %s', (segments: string[], expected: string) => {
      expect(join(...segments)).toBe(expected);
    });
  });
});
