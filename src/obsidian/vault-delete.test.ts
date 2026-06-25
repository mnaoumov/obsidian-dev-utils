// @vitest-environment jsdom

import type {
  App as AppOriginal,
  TFile as TFileOriginal,
  TFolder as TFolderOriginal
} from 'obsidian';

import {
  App,
  TFile,
  TFolder
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { deleteIfNotUsed } from './vault-delete.ts';

const mocks = vi.hoisted(() => ({
  getAbstractFileOrNull: vi.fn(),
  getBacklinksForFileSafe: vi.fn(() => ({ clear: vi.fn(), count: vi.fn(() => 0) })),
  isEmptyFolder: vi.fn(() => true),
  listSafe: vi.fn(() => ({ files: [] as TFileOriginal[], folders: [] as TFolderOriginal[] })),
  trashSafe: vi.fn()
}));

vi.mock('../error.ts', () => ({
  printError: vi.fn()
}));

vi.mock('../obsidian/file-system.ts', () => ({
  getAbstractFileOrNull: mocks.getAbstractFileOrNull,
  isFile: vi.fn((f: unknown) => f instanceof TFile),
  isFolder: vi.fn((f: unknown) => f instanceof TFolder)
}));

vi.mock('../obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selector: unknown, _opts?: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'mock-translation';
  })
}));

vi.mock('../obsidian/metadata-cache.ts', () => ({
  getBacklinksForFileSafe: mocks.getBacklinksForFileSafe
}));

vi.mock('../obsidian/vault.ts', () => ({
  isEmptyFolder: mocks.isEmptyFolder,
  listSafe: mocks.listSafe,
  trashSafe: mocks.trashSafe
}));

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
  vi.clearAllMocks();
  mocks.isEmptyFolder.mockResolvedValue(true);
  mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
  mocks.trashSafe.mockResolvedValue(undefined);
});

describe('deleteIfNotUsed', () => {
  it('should return false when file does not exist', async () => {
    mocks.getAbstractFileOrNull.mockReturnValue(null);
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: 'nonexistent.md'
    });
    expect(result).toBe(false);
  });

  it('should delete a file with no backlinks', async () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: file
    });
    expect(result).toBe(true);

    expect(mocks.trashSafe).toHaveBeenCalledWith(app, file);
  });

  it('should not delete a file with backlinks', async () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 2) });
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: file
    });
    expect(result).toBe(false);

    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should clear backlinks from the deleted note path', async () => {
    const file = TFile.create__(castTo(app.vault), 'attachment.png').asOriginalType2__();
    const clearFn = vi.fn();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: clearFn, count: vi.fn(() => 0) });
    await deleteIfNotUsed({
      app,
      deletedNotePath: 'deleted-note.md',
      pathOrFile: file
    });
    expect(clearFn).toHaveBeenCalledWith('deleted-note.md');
  });

  it('should show notice for used attachments when pluginNoticeComponent is provided', async () => {
    const file = TFile.create__(castTo(app.vault), 'attachment.png').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 1) });
    const showNotice = vi.fn();
    await deleteIfNotUsed({
      app,
      pathOrFile: file,
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice })
    });

    expect(showNotice).toHaveBeenCalledTimes(1);
    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should recursively delete folder contents', async () => {
    const folder = TFolder.create__(castTo(app.vault), 'folder').asOriginalType2__();
    const childFile = TFile.create__(castTo(app.vault), 'folder/note.md').asOriginalType2__();

    mocks.getAbstractFileOrNull.mockImplementation((_app: unknown, f: unknown) => f);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    mocks.listSafe.mockResolvedValue({ files: [childFile], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: folder
    });
    expect(result).toBe(true);
  });

  it('should not delete folder when shouldDeleteEmptyFolders is false', async () => {
    const folder = TFolder.create__(castTo(app.vault), 'folder').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: folder,
      shouldDeleteEmptyFolders: false
    });
    expect(result).toBe(false);

    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should handle trashSafe failure gracefully', async () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    mocks.trashSafe.mockRejectedValue(new Error('trash failed'));

    const result = await deleteIfNotUsed({
      app,
      pathOrFile: file
    });
    expect(result).toBe(false);
  });
});
