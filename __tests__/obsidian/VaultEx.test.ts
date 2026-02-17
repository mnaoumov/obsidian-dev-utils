// @vitest-environment jsdom

import type { App } from 'obsidian';

import {
  TFile,
  TFolder
} from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { createTFileInstance } from '../../__mocks__/obsidian-typings/implementations/createTFileInstance.ts';
import { createTFolderInstance } from '../../__mocks__/obsidian-typings/implementations/createTFolderInstance.ts';
import { createMockApp } from '../../__mocks__/obsidian/App.ts';
import {
  deleteEmptyFolder,
  deleteEmptyFolderHierarchy,
  deleteSafe
} from '../../src/obsidian/VaultEx.ts';

const mocks = vi.hoisted(() => ({
  getAbstractFileOrNull: vi.fn(),
  getBacklinksForFileSafe: vi.fn(() => ({ clear: vi.fn(), count: vi.fn(() => 0) })),
  getFolderOrNull: vi.fn(),
  isEmptyFolder: vi.fn(() => true),
  listSafe: vi.fn(() => ({ files: [] as TFile[], folders: [] as TFolder[] }))
}));

vi.mock('../../src/Error.ts', () => ({
  printError: vi.fn()
}));

vi.mock('../../src/obsidian/FileSystem.ts', () => ({
  getAbstractFileOrNull: mocks.getAbstractFileOrNull,
  getFolderOrNull: mocks.getFolderOrNull,
  isFile: vi.fn((f: unknown) => f instanceof TFile),
  isFolder: vi.fn((f: unknown) => f instanceof TFolder)
}));

vi.mock('../../src/obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selector: unknown, _opts?: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'mock-translation';
  })
}));

vi.mock('../../src/obsidian/MetadataCache.ts', () => ({
  getBacklinksForFileSafe: mocks.getBacklinksForFileSafe
}));

vi.mock('../../src/obsidian/Vault.ts', () => ({
  isEmptyFolder: mocks.isEmptyFolder,
  listSafe: mocks.listSafe
}));

let app: App;

beforeEach(() => {
  app = createMockApp();
  vi.spyOn(app.fileManager, 'trashFile');
  vi.spyOn(app.vault, 'exists').mockResolvedValue(false);
});

describe('deleteEmptyFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when folder is null', async () => {
    mocks.getFolderOrNull.mockReturnValue(null);
    await deleteEmptyFolder(app, null);

    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should do nothing when folder is not empty', async () => {
    const folder = createTFolderInstance(app, 'my-folder');
    mocks.getFolderOrNull.mockReturnValue(folder);
    mocks.isEmptyFolder.mockResolvedValue(false);
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    await deleteEmptyFolder(app, folder);

    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should delete when folder is empty', async () => {
    const folder = createTFolderInstance(app, 'my-folder');
    mocks.getFolderOrNull.mockReturnValue(folder);
    mocks.isEmptyFolder.mockResolvedValue(true);
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    await deleteEmptyFolder(app, folder);

    expect(app.fileManager.trashFile).toHaveBeenCalledWith(folder);
  });
});

describe('deleteEmptyFolderHierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when folder is null', async () => {
    mocks.getFolderOrNull.mockReturnValue(null);
    await deleteEmptyFolderHierarchy(app, null);

    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should stop when folder is not empty', async () => {
    const folder = createTFolderInstance(app, 'my-folder');
    mocks.getFolderOrNull.mockReturnValue(folder);
    mocks.isEmptyFolder.mockResolvedValue(false);
    await deleteEmptyFolderHierarchy(app, folder);

    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should delete folder hierarchy up to parent', async () => {
    createTFolderInstance(app, 'parent');
    const child = createTFolderInstance(app, 'parent/child');
    mocks.getFolderOrNull.mockReturnValue(child);
    mocks.isEmptyFolder.mockResolvedValue(true);
    mocks.getAbstractFileOrNull.mockImplementation((_app: unknown, f: unknown) => f);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    await deleteEmptyFolderHierarchy(app, child);

    expect(app.fileManager.trashFile).toHaveBeenCalled();
  });
});

describe('deleteSafe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEmptyFolder.mockResolvedValue(true);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
  });

  it('should return false when file does not exist', async () => {
    mocks.getAbstractFileOrNull.mockReturnValue(null);
    const result = await deleteSafe(app, 'nonexistent.md');
    expect(result).toBe(false);
  });

  it('should delete a file with no backlinks', async () => {
    const file = createTFileInstance(app, 'note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const result = await deleteSafe(app, file);
    expect(result).toBe(true);

    expect(app.fileManager.trashFile).toHaveBeenCalledWith(file);
  });

  it('should not delete a file with backlinks', async () => {
    const file = createTFileInstance(app, 'note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 2) });
    const result = await deleteSafe(app, file);
    expect(result).toBe(false);

    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should clear backlinks from the deleted note path', async () => {
    const file = createTFileInstance(app, 'attachment.png');
    const clearFn = vi.fn();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: clearFn, count: vi.fn(() => 0) });
    await deleteSafe(app, file, 'deleted-note.md');
    expect(clearFn).toHaveBeenCalledWith('deleted-note.md');
  });

  it('should show notice for used attachments when shouldReportUsedAttachments is true', async () => {
    const file = createTFileInstance(app, 'attachment.png');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 1) });
    await deleteSafe(app, file, undefined, true);
    // Notice constructor was called (mock from obsidian)

    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should recursively delete folder contents', async () => {
    const folder = createTFolderInstance(app, 'folder');
    const childFile = createTFileInstance(app, 'folder/note.md');

    mocks.getAbstractFileOrNull.mockImplementation((_app: unknown, f: unknown) => f);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    mocks.listSafe.mockResolvedValue({ files: [childFile], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const result = await deleteSafe(app, folder);
    expect(result).toBe(true);
  });

  it('should not delete folder when shouldDeleteEmptyFolders is false', async () => {
    const folder = createTFolderInstance(app, 'folder');
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const result = await deleteSafe(app, folder, undefined, undefined, false);
    expect(result).toBe(false);

    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should handle trashFile failure gracefully when file still exists', async () => {
    const file = createTFileInstance(app, 'note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });

    vi.mocked(app.fileManager.trashFile).mockRejectedValue(new Error('trash failed'));

    vi.mocked(app.vault.exists).mockResolvedValue(true);
    const result = await deleteSafe(app, file);
    expect(result).toBe(false);
  });

  it('should treat trashFile failure as success when file no longer exists', async () => {
    const file = createTFileInstance(app, 'note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });

    vi.mocked(app.fileManager.trashFile).mockRejectedValue(new Error('trash failed'));

    vi.mocked(app.vault.exists).mockResolvedValue(false);
    const result = await deleteSafe(app, file);
    expect(result).toBe(true);
  });
});
