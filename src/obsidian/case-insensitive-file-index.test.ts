import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { noopAsync } from '../function.ts';
import { assertNonNullable } from '../type-guards.ts';
import {
  CaseInsensitiveFileIndex,
  getCaseInsensitiveFileIndex,
  setCaseInsensitiveFileIndex,
  unsetCaseInsensitiveFileIndex
} from './case-insensitive-file-index.ts';

let app: AppOriginal;

beforeEach(async () => {
  await noopAsync();
  app = App.createConfigured__({
    files: {
      'Folder/Note.md': '',
      'Folder/Sub/Deep.md': '',
      'Root.md': ''
    }
  }).asOriginalType__();
});

describe('CaseInsensitiveFileIndex', () => {
  describe('add and get', () => {
    it('should resolve an added file case-insensitively', () => {
      const index = new CaseInsensitiveFileIndex(app);
      const file = app.vault.getFileByPath('Root.md');
      assertNonNullable(file);
      index.add(file);
      expect(index.get('root.md')).toBe(file);
      expect(index.get('Root.md')).toBe(file);
    });

    it('should return null for a missing path', () => {
      const index = new CaseInsensitiveFileIndex(app);
      expect(index.get('missing.md')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove the file at the given path', () => {
      const index = new CaseInsensitiveFileIndex(app);
      const file = app.vault.getFileByPath('Root.md');
      assertNonNullable(file);
      index.add(file);
      index.delete('ROOT.MD');
      expect(index.get('root.md')).toBeNull();
    });

    it('should remove all descendants of a deleted folder while keeping unrelated entries', () => {
      const index = new CaseInsensitiveFileIndex(app);
      const folder = app.vault.getFolderByPath('Folder');
      const note = app.vault.getFileByPath('Folder/Note.md');
      const deep = app.vault.getFileByPath('Folder/Sub/Deep.md');
      const root = app.vault.getFileByPath('Root.md');
      assertNonNullable(folder);
      assertNonNullable(note);
      assertNonNullable(deep);
      assertNonNullable(root);
      index.add(folder);
      index.add(note);
      index.add(deep);
      index.add(root);

      index.delete('Folder');

      expect(index.get('folder')).toBeNull();
      expect(index.get('folder/note.md')).toBeNull();
      expect(index.get('folder/sub/deep.md')).toBeNull();
      expect(index.get('root.md')).toBe(root);
    });
  });

  describe('rename', () => {
    it('should re-key a renamed file', async () => {
      const index = new CaseInsensitiveFileIndex(app);
      const file = app.vault.getFileByPath('Root.md');
      assertNonNullable(file);
      index.add(file);

      await app.vault.rename(file, 'Renamed.md');
      index.rename('Root.md', file);

      expect(index.get('renamed.md')).toBe(file);
      expect(index.get('root.md')).toBeNull();
    });

    it('should re-key a renamed folder and all of its descendants while keeping unrelated entries', async () => {
      const index = new CaseInsensitiveFileIndex(app);
      const folder = app.vault.getFolderByPath('Folder');
      const note = app.vault.getFileByPath('Folder/Note.md');
      const deep = app.vault.getFileByPath('Folder/Sub/Deep.md');
      const root = app.vault.getFileByPath('Root.md');
      assertNonNullable(folder);
      assertNonNullable(note);
      assertNonNullable(deep);
      assertNonNullable(root);
      index.add(folder);
      index.add(note);
      index.add(deep);
      index.add(root);

      await app.vault.rename(folder, 'Renamed');
      index.rename('Folder', folder);

      expect(index.get('renamed')).toBe(folder);
      expect(index.get('renamed/note.md')).toBe(note);
      expect(index.get('renamed/sub/deep.md')).toBe(deep);
      expect(index.get('folder')).toBeNull();
      expect(index.get('folder/note.md')).toBeNull();
      expect(index.get('root.md')).toBe(root);
    });

    it('should handle a case-only rename', async () => {
      const index = new CaseInsensitiveFileIndex(app);
      const file = app.vault.getFileByPath('Root.md');
      assertNonNullable(file);
      index.add(file);

      await app.vault.rename(file, 'ROOT.md');
      index.rename('Root.md', file);

      expect(index.get('root.md')).toBe(file);
    });
  });

  describe('ownsApp', () => {
    it('should report whether the index belongs to a given app', () => {
      const index = new CaseInsensitiveFileIndex(app);
      const otherApp = App.createConfigured__().asOriginalType__();
      expect(index.ownsApp(app)).toBe(true);
      expect(index.ownsApp(otherApp)).toBe(false);
    });
  });
});

describe('getCaseInsensitiveFileIndex', () => {
  it('should return null when no index is installed', () => {
    expect(getCaseInsensitiveFileIndex(app)).toBeNull();
  });

  it('should return the installed index for its owning app', () => {
    const index = new CaseInsensitiveFileIndex(app);
    setCaseInsensitiveFileIndex(index);
    expect(getCaseInsensitiveFileIndex(app)).toBe(index);
  });

  it('should return null for a different app even when an index is installed', () => {
    const index = new CaseInsensitiveFileIndex(app);
    setCaseInsensitiveFileIndex(index);
    const otherApp = App.createConfigured__().asOriginalType__();
    expect(getCaseInsensitiveFileIndex(otherApp)).toBeNull();
  });
});

describe('unsetCaseInsensitiveFileIndex', () => {
  it('should remove the index when it is the currently-installed one', () => {
    const index = new CaseInsensitiveFileIndex(app);
    setCaseInsensitiveFileIndex(index);
    unsetCaseInsensitiveFileIndex(index);
    expect(getCaseInsensitiveFileIndex(app)).toBeNull();
  });

  it('should be a no-op when a different index is currently installed', () => {
    const index = new CaseInsensitiveFileIndex(app);
    setCaseInsensitiveFileIndex(index);
    const otherIndex = new CaseInsensitiveFileIndex(app);
    unsetCaseInsensitiveFileIndex(otherIndex);
    expect(getCaseInsensitiveFileIndex(app)).toBe(index);
  });
});
