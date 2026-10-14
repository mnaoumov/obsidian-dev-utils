import type {
  App,
  DataAdapter
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { relativePathToResourceUrl } from './resource-url.ts';

vi.mock('obsidian', () => ({
  Platform: {
    resourcePathPrefix: 'app://local/'
  }
}));

function createMockApp(fullRealPath: string): App {
  return strictProxy<App>({
    vault: {
      adapter: castTo<DataAdapter>({
        getFullRealPath: vi.fn(() => fullRealPath)
      })
    }
  });
}

describe('relativePathToResourceUrl', () => {
  it('should convert a relative path to a resource URL', () => {
    const app = createMockApp(String.raw`C:\vault\notes\note.md`);
    const result = relativePathToResourceUrl({ app, notePath: 'notes/note.md', relativePath: 'image.png' });
    expect(result).toBe('app://local/C:/vault/notes/image.png');
  });

  it('should handle relative paths with subdirectories', () => {
    const app = createMockApp(String.raw`C:\vault\notes\note.md`);
    const result = relativePathToResourceUrl({ app, notePath: 'notes/note.md', relativePath: 'attachments/photo.jpg' });
    expect(result).toBe('app://local/C:/vault/notes/attachments/photo.jpg');
  });

  it('should handle parent directory references', () => {
    const app = createMockApp(String.raw`C:\vault\notes\sub\note.md`);
    const result = relativePathToResourceUrl({ app, notePath: 'notes/sub/note.md', relativePath: '../image.png' });
    expect(result).toBe('app://local/C:/vault/notes/image.png');
  });

  it('should handle already-POSIX paths from adapter', () => {
    const app = createMockApp('/home/user/vault/note.md');
    const result = relativePathToResourceUrl({ app, notePath: 'note.md', relativePath: 'file.pdf' });
    expect(result).toBe('app://local//home/user/vault/file.pdf');
  });
});
