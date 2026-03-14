import type { App } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { relativePathToResourceUrl } from './resource-url.ts';

vi.mock('obsidian', () => ({
  Platform: {
    resourcePathPrefix: 'app://local/'
  }
}));

function createMockApp(fullRealPath: string): App {
  return castTo<App>({
    vault: {
      adapter: {
        getFullRealPath: vi.fn(() => fullRealPath)
      }
    }
  });
}

describe('relativePathToResourceUrl', () => {
  it('should convert a relative path to a resource URL', () => {
    const app = createMockApp('C:\\vault\\notes\\note.md');
    const result = relativePathToResourceUrl(app, 'image.png', 'notes/note.md');
    expect(result).toBe('app://local/C:/vault/notes/image.png');
  });

  it('should handle relative paths with subdirectories', () => {
    const app = createMockApp('C:\\vault\\notes\\note.md');
    const result = relativePathToResourceUrl(app, 'attachments/photo.jpg', 'notes/note.md');
    expect(result).toBe('app://local/C:/vault/notes/attachments/photo.jpg');
  });

  it('should handle parent directory references', () => {
    const app = createMockApp('C:\\vault\\notes\\sub\\note.md');
    const result = relativePathToResourceUrl(app, '../image.png', 'notes/sub/note.md');
    expect(result).toBe('app://local/C:/vault/notes/image.png');
  });

  it('should handle already-POSIX paths from adapter', () => {
    const app = createMockApp('/home/user/vault/note.md');
    const result = relativePathToResourceUrl(app, 'file.pdf', 'note.md');
    expect(result).toBe('app://local//home/user/vault/file.pdf');
  });
});
