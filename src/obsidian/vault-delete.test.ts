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
import type { GetAbstractFileOrNullParams } from './file-system.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  deleteIfNotUsed,
  DeleteIfNotUsedResult
} from './vault-delete.ts';

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
  t: vi.fn((selector: unknown, _options?: unknown) => {
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
  it('should report not-deleted when file does not exist', async () => {
    mocks.getAbstractFileOrNull.mockReturnValue(null);
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: 'nonexistent.md'
    });
    expect(result).toBe(DeleteIfNotUsedResult.NotDeleted);
  });

  it('should delete a file with no backlinks', async () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: file
    });
    expect(result).toBe(DeleteIfNotUsedResult.Deleted);

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
    expect(result).toBe(DeleteIfNotUsedResult.NotDeleted);

    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should clear backlinks from the deleted note path', async () => {
    const file = TFile.create__(castTo(app.vault), 'attachment.png').asOriginalType2__();
    const clearFunction = vi.fn();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: clearFunction, count: vi.fn(() => 0) });
    await deleteIfNotUsed({
      app,
      deletedNotePath: 'deleted-note.md',
      pathOrFile: file
    });
    expect(clearFunction).toHaveBeenCalledWith('deleted-note.md');
  });

  it('should clear backlinks from every deleted note path', async () => {
    const file = TFile.create__(castTo(app.vault), 'folder/attachment.png').asOriginalType2__();
    const clearFunction = vi.fn();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: clearFunction, count: vi.fn(() => 0) });
    await deleteIfNotUsed({
      app,
      deletedNotePaths: ['folder/note1.md', 'folder/note2.md'],
      pathOrFile: file
    });
    expect(clearFunction).toHaveBeenCalledWith('folder/note1.md');
    expect(clearFunction).toHaveBeenCalledWith('folder/note2.md');
    expect(clearFunction).toHaveBeenCalledTimes(2);
  });

  it('should merge deletedNotePath into deletedNotePaths without clearing it twice', async () => {
    const file = TFile.create__(castTo(app.vault), 'folder/attachment.png').asOriginalType2__();
    const clearFunction = vi.fn();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: clearFunction, count: vi.fn(() => 0) });
    await deleteIfNotUsed({
      app,
      deletedNotePath: 'folder/note1.md',
      deletedNotePaths: ['folder/note1.md', 'folder/note2.md'],
      pathOrFile: file
    });
    expect(clearFunction).toHaveBeenCalledWith('folder/note1.md');
    expect(clearFunction).toHaveBeenCalledWith('folder/note2.md');
    expect(clearFunction).toHaveBeenCalledTimes(2);
  });

  it('should delete via deleteAbstractFile instead of trashSafe when provided', async () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const deleteAbstractFile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    const result = await deleteIfNotUsed({
      app,
      deleteAbstractFile,
      pathOrFile: file
    });
    expect(result).toBe(DeleteIfNotUsedResult.Deleted);

    expect(deleteAbstractFile).toHaveBeenCalledWith(file);
    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should report not-deleted when deleteAbstractFile fails', async () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const deleteAbstractFile = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('delete failed'));

    const result = await deleteIfNotUsed({
      app,
      deleteAbstractFile,
      pathOrFile: file
    });
    expect(result).toBe(DeleteIfNotUsedResult.NotDeleted);
  });

  it('should delete a still-used file that shouldProtectIfStillUsed rejects', async () => {
    const file = TFile.create__(castTo(app.vault), 'folder/note.md').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 3) });
    const showNotice = vi.fn();

    const result = await deleteIfNotUsed({
      app,
      pathOrFile: file,
      pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice }),
      shouldProtectIfStillUsed: () => false
    });
    expect(result).toBe(DeleteIfNotUsedResult.Deleted);

    expect(mocks.getBacklinksForFileSafe).not.toHaveBeenCalled();
    expect(showNotice).not.toHaveBeenCalled();
    expect(mocks.trashSafe).toHaveBeenCalledWith(app, file);
  });

  it('should keep a still-used file that shouldProtectIfStillUsed accepts', async () => {
    const file = TFile.create__(castTo(app.vault), 'folder/attachment.png').asOriginalType2__();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 3) });

    const result = await deleteIfNotUsed({
      app,
      pathOrFile: file,
      shouldProtectIfStillUsed: () => true
    });
    expect(result).toBe(DeleteIfNotUsedResult.NotDeleted);

    expect(mocks.trashSafe).not.toHaveBeenCalled();
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

    mocks.getAbstractFileOrNull.mockImplementation((params: GetAbstractFileOrNullParams) => params.pathOrFile);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    mocks.listSafe.mockResolvedValue({ files: [childFile], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const result = await deleteIfNotUsed({
      app,
      pathOrFile: folder
    });
    expect(result).toBe(DeleteIfNotUsedResult.Deleted);
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
    expect(result).toBe(DeleteIfNotUsedResult.NotDeleted);

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
    expect(result).toBe(DeleteIfNotUsedResult.NotDeleted);
  });
});
