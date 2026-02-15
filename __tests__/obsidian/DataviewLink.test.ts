import {
  describe,
  expect,
  it
} from 'vitest';

import type { Link } from '../../src/obsidian/Dataview.ts';

import { makeLinkWithPath } from '../../src/obsidian/DataviewLink.ts';

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
