import {
  describe,
  expect,
  it
} from 'vitest';

import {
  PathSettings,
  pathsValidator
} from './path-settings.ts';

const REPORTED_REG_EXP = String.raw`/^Inbox\/[^\/]*$/`;
const DANGLING_ESCAPE = String.raw`/^Inbox\/`;
const UNBALANCED_CHARACTER_CLASS = String.raw`/^Inbox\/[^\/`;
const UNBALANCED_GROUP = '/(Inbox/';

describe('PathSettings', () => {
  describe('excludePaths', () => {
    it('should not ignore any paths by default', () => {
      const ps = new PathSettings();
      expect(ps.isPathIgnored('some/path')).toBe(false);
    });

    it('should ignore paths matching exclude patterns', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['secret'];
      expect(ps.isPathIgnored('secret')).toBe(true);
      expect(ps.isPathIgnored('secret/file.md')).toBe(true);
      expect(ps.isPathIgnored('other/path')).toBe(false);
    });

    it('should filter out empty strings from arrays', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['', 'dir', ''];
      expect(ps.excludePaths).toEqual(['dir']);
    });

    it('should return the set array via getter', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['a', 'b'];
      expect(ps.excludePaths).toEqual(['a', 'b']);
    });

    it('should reset to default when set to empty array', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['secret'];
      expect(ps.isPathIgnored('secret')).toBe(true);
      ps.excludePaths = [];
      expect(ps.isPathIgnored('secret')).toBe(false);
    });
  });

  describe('includePaths', () => {
    it('should include all paths by default', () => {
      const ps = new PathSettings();
      expect(ps.isPathIgnored('anything')).toBe(false);
    });

    it('should ignore paths not matching include patterns', () => {
      const ps = new PathSettings();
      ps.includePaths = ['allowed'];
      expect(ps.isPathIgnored('allowed')).toBe(false);
      expect(ps.isPathIgnored('allowed/file.md')).toBe(false);
      expect(ps.isPathIgnored('other')).toBe(true);
    });

    it('should return the set array via getter', () => {
      const ps = new PathSettings();
      ps.includePaths = ['x', 'y'];
      expect(ps.includePaths).toEqual(['x', 'y']);
    });
  });

  describe('combined include/exclude', () => {
    it('should ignore paths excluded even if included', () => {
      const ps = new PathSettings();
      ps.includePaths = ['project'];
      ps.excludePaths = ['project/secret'];
      expect(ps.isPathIgnored('project/public')).toBe(false);
      expect(ps.isPathIgnored('project/secret')).toBe(true);
      expect(ps.isPathIgnored('other')).toBe(true);
    });
  });

  describe('regex path patterns', () => {
    it('should support regex patterns delimited by slashes', () => {
      const ps = new PathSettings();
      ps.excludePaths = [String.raw`/\.git/`];
      expect(ps.isPathIgnored('.git')).toBe(true);
      expect(ps.isPathIgnored('foo/.git/bar')).toBe(true);
      expect(ps.isPathIgnored('xgit')).toBe(false);
    });

    it('should treat "/" as default pattern for exclude (never match)', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['/'];
      expect(ps.isPathIgnored('anything')).toBe(false);
    });

    it('should treat "/" as default pattern for include (always match)', () => {
      const ps = new PathSettings();
      ps.includePaths = ['/'];
      expect(ps.isPathIgnored('anything')).toBe(false);
    });

    it('should strip trailing slashes from plain paths', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['dir/'];
      expect(ps.isPathIgnored('dir')).toBe(true);
      expect(ps.isPathIgnored('dir/file')).toBe(true);
    });
  });

  describe('path matching details', () => {
    it('should match exact path or path with slash suffix', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['folder'];
      expect(ps.isPathIgnored('folder')).toBe(true);
      expect(ps.isPathIgnored('folder/sub')).toBe(true);
      expect(ps.isPathIgnored('folderx')).toBe(false);
    });

    it('should handle multiple exclude paths', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['a', 'b'];
      expect(ps.isPathIgnored('a')).toBe(true);
      expect(ps.isPathIgnored('b')).toBe(true);
      expect(ps.isPathIgnored('c')).toBe(false);
    });

    it('should handle multiple include paths', () => {
      const ps = new PathSettings();
      ps.includePaths = ['a', 'b'];
      expect(ps.isPathIgnored('a')).toBe(false);
      expect(ps.isPathIgnored('b')).toBe(false);
      expect(ps.isPathIgnored('c')).toBe(true);
    });

    it('should handle special regex characters in paths', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['dir.name'];
      expect(ps.isPathIgnored('dir.name')).toBe(true);
      expect(ps.isPathIgnored('dirxname')).toBe(false);
    });
  });

  describe('un-parseable regex patterns', () => {
    it('should not throw for any prefix typed on the way to a valid regex', () => {
      const ps = new PathSettings();
      for (let length = 1; length <= REPORTED_REG_EXP.length; length++) {
        const prefix = REPORTED_REG_EXP.slice(0, length);
        expect(() => {
          ps.excludePaths = [prefix];
        }, prefix).not.toThrow();
      }
    });

    it('should match as usual once the typed regex is completed', () => {
      const ps = new PathSettings();
      ps.excludePaths = [REPORTED_REG_EXP];
      expect(ps.isPathIgnored('Inbox/note.md')).toBe(true);
      expect(ps.isPathIgnored('Inbox/sub/note.md')).toBe(false);
      expect(ps.isPathIgnored('Other/note.md')).toBe(false);
    });

    it.each([DANGLING_ESCAPE, UNBALANCED_CHARACTER_CLASS, UNBALANCED_GROUP])('should exclude nothing for un-parseable exclude pattern %s', (path) => {
      const ps = new PathSettings();
      ps.excludePaths = [path];
      expect(ps.isPathIgnored('Inbox/note.md')).toBe(false);
      expect(ps.isPathIgnored('anything')).toBe(false);
    });

    it.each([DANGLING_ESCAPE, UNBALANCED_CHARACTER_CLASS, UNBALANCED_GROUP])('should include everything for un-parseable include pattern %s', (path) => {
      const ps = new PathSettings();
      ps.includePaths = [path];
      expect(ps.isPathIgnored('Inbox/note.md')).toBe(false);
      expect(ps.isPathIgnored('anything')).toBe(false);
    });

    it('should fall back to the default pattern when only some entries are un-parseable', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['secret', DANGLING_ESCAPE];
      expect(ps.isPathIgnored('secret')).toBe(false);
    });

    it('should keep the entries as set', () => {
      const ps = new PathSettings();
      ps.excludePaths = ['secret', DANGLING_ESCAPE];
      expect(ps.excludePaths).toEqual(['secret', DANGLING_ESCAPE]);
    });

    it('should not throw when the same un-parseable value is assigned again', () => {
      const ps = new PathSettings();
      ps.excludePaths = [DANGLING_ESCAPE];
      const savedPaths = ps.excludePaths;
      expect(() => {
        ps.excludePaths = savedPaths;
      }).not.toThrow();
    });

    it('should recover once an un-parseable value is replaced with a valid one', () => {
      const ps = new PathSettings();
      ps.excludePaths = [DANGLING_ESCAPE];
      expect(ps.isPathIgnored('secret')).toBe(false);
      ps.excludePaths = ['secret'];
      expect(ps.isPathIgnored('secret')).toBe(true);
    });
  });
});

describe('pathsValidator', () => {
  it('should accept an empty array', () => {
    expect(pathsValidator([])).toBeUndefined();
  });

  it('should accept plain paths', () => {
    expect(pathsValidator(['dir', 'dir/sub', 'dir.name'])).toBeUndefined();
  });

  it('should accept valid regex patterns', () => {
    expect(pathsValidator([REPORTED_REG_EXP, String.raw`/\.git/`, '/'])).toBeUndefined();
  });

  it.each([DANGLING_ESCAPE, UNBALANCED_CHARACTER_CLASS, UNBALANCED_GROUP])('should reject un-parseable regex pattern %s', (path) => {
    expect(pathsValidator([path])).toContain(path);
  });

  it('should report the first un-parseable entry', () => {
    expect(pathsValidator(['dir', UNBALANCED_GROUP, DANGLING_ESCAPE])).toContain(UNBALANCED_GROUP);
  });
});
