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
import { deleteIfNotUsed } from '../../src/obsidian/vault-delete.ts';

const mocks = vi.hoisted(() => ({
  getAbstractFileOrNull: vi.fn(),
  getBacklinksForFileSafe: vi.fn(() => ({ clear: vi.fn(), count: vi.fn(() => 0) })),
  isEmptyFolder: vi.fn(() => true),
  listSafe: vi.fn(() => ({ files: [] as TFile[], folders: [] as TFolder[] })),
  trashSafe: vi.fn()
}));

vi.mock('../../src/error.ts', () => ({
  printError: vi.fn()
}));

vi.mock('../../src/obsidian/file-system.ts', () => ({
  getAbstractFileOrNull: mocks.getAbstractFileOrNull,
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

vi.mock('../../src/obsidian/metadata-cache.ts', () => ({
  getBacklinksForFileSafe: mocks.getBacklinksForFileSafe
}));

vi.mock('../../src/obsidian/vault.ts', () => ({
  isEmptyFolder: mocks.isEmptyFolder,
  listSafe: mocks.listSafe,
  trashSafe: mocks.trashSafe
}));

let app: App;

beforeEach(() => {
  app = createMockApp();
  vi.clearAllMocks();
  mocks.isEmptyFolder.mockResolvedValue(true);
  mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
  mocks.trashSafe.mockResolvedValue(undefined);
});

describe('deleteIfNotUsed', () => {
  it('should return false when file does not exist', async () => {
    mocks.getAbstractFileOrNull.mockReturnValue(null);
    const result = await deleteIfNotUsed(app, 'nonexistent.md');
    expect(result).toBe(false);
  });

  it('should delete a file with no backlinks', async () => {
    const file = createTFileInstance(app, 'note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const result = await deleteIfNotUsed(app, file);
    expect(result).toBe(true);

    expect(mocks.trashSafe).toHaveBeenCalledWith(app, file);
  });

  it('should not delete a file with backlinks', async () => {
    const file = createTFileInstance(app, 'note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 2) });
    const result = await deleteIfNotUsed(app, file);
    expect(result).toBe(false);

    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should clear backlinks from the deleted note path', async () => {
    const file = createTFileInstance(app, 'attachment.png');
    const clearFn = vi.fn();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: clearFn, count: vi.fn(() => 0) });
    await deleteIfNotUsed(app, file, 'deleted-note.md');
    expect(clearFn).toHaveBeenCalledWith('deleted-note.md');
  });

  it('should show notice for used attachments when shouldReportUsedAttachments is true', async () => {
    const file = createTFileInstance(app, 'attachment.png');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 1) });
    await deleteIfNotUsed(app, file, undefined, true);

    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should recursively delete folder contents', async () => {
    const folder = createTFolderInstance(app, 'folder');
    const childFile = createTFileInstance(app, 'folder/note.md');

    mocks.getAbstractFileOrNull.mockImplementation((_app: unknown, f: unknown) => f);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    mocks.listSafe.mockResolvedValue({ files: [childFile], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const result = await deleteIfNotUsed(app, folder);
    expect(result).toBe(true);
  });

  it('should not delete folder when shouldDeleteEmptyFolders is false', async () => {
    const folder = createTFolderInstance(app, 'folder');
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const result = await deleteIfNotUsed(app, folder, undefined, undefined, false);
    expect(result).toBe(false);

    expect(mocks.trashSafe).not.toHaveBeenCalled();
  });

  it('should handle trashSafe failure gracefully', async () => {
    const file = createTFileInstance(app, 'note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    mocks.trashSafe.mockRejectedValue(new Error('trash failed'));

    const result = await deleteIfNotUsed(app, file);
    expect(result).toBe(false);
  });
});
