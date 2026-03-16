import type { App as AppOriginal } from 'obsidian';
import type { PartialDeep } from 'type-fest';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type {
  DataviewInlineApi,
  Link
} from './dataview.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../test-helpers/mock-implementation.ts';
import {
  fixTitle,
  makeLinkWithPath
} from './dataview-link.ts';

describe('makeLinkWithPath', () => {
  it('should format link text with path', () => {
    const link = strictProxy<Link>({
      path: 'folder/note.md',
      toString: (): string => '[[note]]'
    });
    expect(makeLinkWithPath(link)).toBe('[[note]] (folder/note.md)');
  });

  it('should handle root-level path', () => {
    const link = strictProxy<Link>({
      path: 'note.md',
      toString: (): string => '[[note]]'
    });
    expect(makeLinkWithPath(link)).toBe('[[note]] (note.md)');
  });

  it('should handle deeply nested path', () => {
    const link = strictProxy<Link>({
      path: 'a/b/c/d.md',
      toString: (): string => '[[d]]'
    });
    expect(makeLinkWithPath(link)).toBe('[[d]] (a/b/c/d.md)');
  });
});

describe('fixTitle', () => {
  function createMockDv(app: AppOriginal): DataviewInlineApi {
    return strictProxy<DataviewInlineApi>({
      app: castTo<PartialDeep<AppOriginal>>(app),
      fileLink: (path: string, _embed: boolean, title: string): Link =>
        castTo<Link>({
          path,
          title
        })
    });
  }

  it('should use basename without extension as title for regular files', async () => {
    const app = (await App.createConfigured__({ files: { 'folder/note.md': '' } })).asOriginalType__();
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'folder/note.md');
    expect(result).toEqual({ path: 'folder/note.md', title: 'note' });
  });

  it('should use folder name as title when isFolderNote is true', async () => {
    const app = (await App.createConfigured__({ files: { 'projects/my-project/my-project.md': '' } })).asOriginalType__();
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'projects/my-project/my-project.md', true);
    expect(result).toEqual({ path: 'projects/my-project/my-project.md', title: 'my-project' });
  });

  it('should use basename without extension when isFolderNote is false', async () => {
    const app = (await App.createConfigured__({ files: { 'folder/document.md': '' } })).asOriginalType__();
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'folder/document.md', false);
    expect(result).toEqual({ path: 'folder/document.md', title: 'document' });
  });

  it('should handle root-level files', async () => {
    const app = (await App.createConfigured__({ files: { 'readme.md': '' } })).asOriginalType__();
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'readme.md');
    expect(result).toEqual({ path: 'readme.md', title: 'readme' });
  });
});
