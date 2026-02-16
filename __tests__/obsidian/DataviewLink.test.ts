import type { App } from 'obsidian';

import {
  describe,
  expect,
  it
} from 'vitest';

import type {
  DataviewInlineApi,
  Link
} from '../../src/obsidian/Dataview.ts';

import { createMockApp } from '../../__mocks__/obsidian/App.ts';
import {
  fixTitle,
  makeLinkWithPath
} from '../../src/obsidian/DataviewLink.ts';

describe('makeLinkWithPath', () => {
  it('should format link text with path', () => {
    const link = {
      path: 'folder/note.md',
      toString: (): string => '[[note]]'
    } as Link;
    expect(makeLinkWithPath(link)).toBe('[[note]] (folder/note.md)');
  });

  it('should handle root-level path', () => {
    const link = {
      path: 'note.md',
      toString: (): string => '[[note]]'
    } as Link;
    expect(makeLinkWithPath(link)).toBe('[[note]] (note.md)');
  });

  it('should handle deeply nested path', () => {
    const link = {
      path: 'a/b/c/d.md',
      toString: (): string => '[[d]]'
    } as Link;
    expect(makeLinkWithPath(link)).toBe('[[d]] (a/b/c/d.md)');
  });
});

describe('fixTitle', () => {
  function createMockDv(app: App): DataviewInlineApi {
    return {
      app,
      fileLink: (path: string, _embed: boolean, title: string): Link =>
        ({
          path,
          title
        }) as unknown as Link
    } as unknown as DataviewInlineApi;
  }

  it('should use basename without extension as title for regular files', () => {
    const app = createMockApp({ files: [{ path: 'folder/note.md' }] });
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'folder/note.md');
    expect(result).toEqual({ path: 'folder/note.md', title: 'note' });
  });

  it('should use folder name as title when isFolderNote is true', () => {
    const app = createMockApp({ files: [{ path: 'projects/my-project/my-project.md' }] });
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'projects/my-project/my-project.md', true);
    expect(result).toEqual({ path: 'projects/my-project/my-project.md', title: 'my-project' });
  });

  it('should use basename without extension when isFolderNote is false', () => {
    const app = createMockApp({ files: [{ path: 'folder/document.md' }] });
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'folder/document.md', false);
    expect(result).toEqual({ path: 'folder/document.md', title: 'document' });
  });

  it('should handle root-level files', () => {
    const app = createMockApp({ files: [{ path: 'readme.md' }] });
    const dv = createMockDv(app);
    const result = fixTitle(dv, 'readme.md');
    expect(result).toEqual({ path: 'readme.md', title: 'readme' });
  });
});
