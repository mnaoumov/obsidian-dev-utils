import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { noopAsync } from '../../function.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { getCaseInsensitiveFileIndex } from '../case-insensitive-file-index.ts';
import { CaseInsensitiveFileIndexComponent } from './case-insensitive-file-index-component.ts';

let app: AppOriginal;

beforeEach(async () => {
  await noopAsync();
  app = App.createConfigured__({ files: { 'Existing.md': '' } }).asOriginalType__();
});

describe('CaseInsensitiveFileIndexComponent', () => {
  it('should install an index of the existing files on load', () => {
    const component = new CaseInsensitiveFileIndexComponent(app);
    component.load();
    try {
      const index = getCaseInsensitiveFileIndex(app);
      assertNonNullable(index);
      const existing = app.vault.getFileByPath('Existing.md');
      expect(index.get('existing.md')).toBe(existing);
    } finally {
      component.unload();
    }
  });

  it('should add a file to the index on create', async () => {
    const component = new CaseInsensitiveFileIndexComponent(app);
    component.load();
    try {
      const file = await app.vault.create('New.md', '');
      const index = getCaseInsensitiveFileIndex(app);
      assertNonNullable(index);
      expect(index.get('new.md')).toBe(file);
    } finally {
      component.unload();
    }
  });

  it('should remove a file from the index on delete', async () => {
    const component = new CaseInsensitiveFileIndexComponent(app);
    component.load();
    try {
      const existing = app.vault.getFileByPath('Existing.md');
      assertNonNullable(existing);
      // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- The test needs the vault `delete` event to fire.
      await app.vault.delete(existing);
      const index = getCaseInsensitiveFileIndex(app);
      assertNonNullable(index);
      expect(index.get('existing.md')).toBeNull();
    } finally {
      component.unload();
    }
  });

  it('should re-key a file in the index on rename', async () => {
    const component = new CaseInsensitiveFileIndexComponent(app);
    component.load();
    try {
      const existing = app.vault.getFileByPath('Existing.md');
      assertNonNullable(existing);
      await app.vault.rename(existing, 'Renamed.md');
      const index = getCaseInsensitiveFileIndex(app);
      assertNonNullable(index);
      expect(index.get('renamed.md')).toBe(existing);
      expect(index.get('existing.md')).toBeNull();
    } finally {
      component.unload();
    }
  });

  it('should remove the index on unload', () => {
    const component = new CaseInsensitiveFileIndexComponent(app);
    component.load();
    expect(getCaseInsensitiveFileIndex(app)).not.toBeNull();
    component.unload();
    expect(getCaseInsensitiveFileIndex(app)).toBeNull();
  });
});
