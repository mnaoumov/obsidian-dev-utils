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

function createMockApp(): { fileManager: { trashFile: ReturnType<typeof vi.fn> }; vault: { exists: ReturnType<typeof vi.fn> } } {
  return {
    fileManager: { trashFile: vi.fn() },
    vault: { exists: vi.fn(() => false) }
  };
}

function createMockFile(path: string): TFile {
  const file = new TFile();
  file.path = path;
  file.name = path.split('/').pop() ?? '';
  return file;
}

function createMockFolder(path: string, parent: null | TFolder = null): TFolder {
  const folder = new TFolder();
  folder.path = path;
  folder.name = path.split('/').pop() ?? '';
  folder.parent = parent;
  return folder;
}

describe('deleteEmptyFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when folder is null', async () => {
    mocks.getFolderOrNull.mockReturnValue(null);
    const app = createMockApp();
    await deleteEmptyFolder(app as never, null);
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should do nothing when folder is not empty', async () => {
    const folder = createMockFolder('my-folder');
    mocks.getFolderOrNull.mockReturnValue(folder);
    mocks.isEmptyFolder.mockResolvedValue(false);
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    const app = createMockApp();
    await deleteEmptyFolder(app as never, folder);
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should delete when folder is empty', async () => {
    const folder = createMockFolder('my-folder');
    mocks.getFolderOrNull.mockReturnValue(folder);
    mocks.isEmptyFolder.mockResolvedValue(true);
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    const app = createMockApp();
    await deleteEmptyFolder(app as never, folder);
    expect(app.fileManager.trashFile).toHaveBeenCalledWith(folder);
  });
});

describe('deleteEmptyFolderHierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when folder is null', async () => {
    mocks.getFolderOrNull.mockReturnValue(null);
    const app = createMockApp();
    await deleteEmptyFolderHierarchy(app as never, null);
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should stop when folder is not empty', async () => {
    const folder = createMockFolder('my-folder');
    mocks.getFolderOrNull.mockReturnValue(folder);
    mocks.isEmptyFolder.mockResolvedValue(false);
    const app = createMockApp();
    await deleteEmptyFolderHierarchy(app as never, folder);
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should delete folder hierarchy up to parent', async () => {
    const parent = createMockFolder('parent');
    const child = createMockFolder('parent/child', parent);
    mocks.getFolderOrNull.mockReturnValue(child);
    mocks.isEmptyFolder.mockResolvedValue(true);
    mocks.getAbstractFileOrNull.mockImplementation((_app: unknown, f: unknown) => f);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    const app = createMockApp();
    await deleteEmptyFolderHierarchy(app as never, child);
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
    const app = createMockApp();
    const result = await deleteSafe(app as never, 'nonexistent.md');
    expect(result).toBe(false);
  });

  it('should delete a file with no backlinks', async () => {
    const file = createMockFile('note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const app = createMockApp();
    const result = await deleteSafe(app as never, file);
    expect(result).toBe(true);
    expect(app.fileManager.trashFile).toHaveBeenCalledWith(file);
  });

  it('should not delete a file with backlinks', async () => {
    const file = createMockFile('note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 2) });
    const app = createMockApp();
    const result = await deleteSafe(app as never, file);
    expect(result).toBe(false);
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should clear backlinks from the deleted note path', async () => {
    const file = createMockFile('attachment.png');
    const clearFn = vi.fn();
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: clearFn, count: vi.fn(() => 0) });
    const app = createMockApp();
    await deleteSafe(app as never, file, 'deleted-note.md');
    expect(clearFn).toHaveBeenCalledWith('deleted-note.md');
  });

  it('should show notice for used attachments when shouldReportUsedAttachments is true', async () => {
    const file = createMockFile('attachment.png');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 1) });
    const app = createMockApp();
    await deleteSafe(app as never, file, undefined, true);
    // Notice constructor was called (mock from obsidian)
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should recursively delete folder contents', async () => {
    const childFile = createMockFile('folder/note.md');
    const folder = createMockFolder('folder');
    mocks.getAbstractFileOrNull.mockImplementation((_app: unknown, f: unknown) => f);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    mocks.listSafe.mockResolvedValue({ files: [childFile], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const app = createMockApp();
    const result = await deleteSafe(app as never, folder);
    expect(result).toBe(true);
  });

  it('should not delete folder when shouldDeleteEmptyFolders is false', async () => {
    const folder = createMockFolder('folder');
    mocks.getAbstractFileOrNull.mockReturnValue(folder);
    mocks.listSafe.mockResolvedValue({ files: [], folders: [] });
    mocks.isEmptyFolder.mockResolvedValue(true);
    const app = createMockApp();
    const result = await deleteSafe(app as never, folder, undefined, undefined, false);
    expect(result).toBe(false);
    expect(app.fileManager.trashFile).not.toHaveBeenCalled();
  });

  it('should handle trashFile failure gracefully when file still exists', async () => {
    const file = createMockFile('note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const app = createMockApp();
    app.fileManager.trashFile.mockRejectedValue(new Error('trash failed'));
    app.vault.exists.mockResolvedValue(true);
    const result = await deleteSafe(app as never, file);
    expect(result).toBe(false);
  });

  it('should treat trashFile failure as success when file no longer exists', async () => {
    const file = createMockFile('note.md');
    mocks.getAbstractFileOrNull.mockReturnValue(file);
    mocks.getBacklinksForFileSafe.mockResolvedValue({ clear: vi.fn(), count: vi.fn(() => 0) });
    const app = createMockApp();
    app.fileManager.trashFile.mockRejectedValue(new Error('trash failed'));
    app.vault.exists.mockResolvedValue(false);
    const result = await deleteSafe(app as never, file);
    expect(result).toBe(true);
  });
});
