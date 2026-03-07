import {
  describe,
  expect,
  it
} from 'vitest';

import { PathSettings } from '../../../src/obsidian/plugin/path-settings.ts';

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
      ps.excludePaths = ['/\\.git/'];
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
});
