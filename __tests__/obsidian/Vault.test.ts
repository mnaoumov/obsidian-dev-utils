import type { App } from 'obsidian';
// @vitest-environment jsdom

import { MarkdownView } from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { RetryWithTimeoutNoticeOptions } from '../../src/obsidian/AsyncWithNotice.ts';

import { createTFileInstance } from '../../__mocks__/obsidian-typings/implementations/createTFileInstance.ts';
import { createTFolderInstance } from '../../__mocks__/obsidian-typings/implementations/createTFolderInstance.ts';
import { createMockApp } from '../../__mocks__/obsidian/App.ts';
import {
  deleteVaultAbstractFile,
  setVaultAbstractFile
} from '../../__mocks__/obsidian/Vault.ts';
import { castTo } from '../../src/ObjectUtils.ts';
import { retryWithTimeoutNotice } from '../../src/obsidian/AsyncWithNotice.ts';
import { lockEditor } from '../../src/obsidian/Editor.ts';
import { FileSystemType } from '../../src/obsidian/FileSystem.ts';
import {
  copySafe,
  createFolderSafe,
  createTempFile,
  createTempFolder,
  getAbstractFilePathSafe,
  getAvailablePath,
  getFilePathSafe,
  getFolderPathSafe,
  getMarkdownFilesSorted,
  getNoteFilesSorted,
  getOrCreateAbstractFileSafe,
  getOrCreateFileSafe,
  getOrCreateFolderSafe,
  getSafeRenamePath,
  invokeWithFileSystemLock,
  isChild,
  isChildOrSelf,
  isEmptyFolder,
  listSafe,
  process as processFile,
  readSafe,
  renameSafe,
  saveNote
} from '../../src/obsidian/Vault.ts';
import { assertNonNullable } from '../../src/TypeGuards.ts';

vi.mock('../../src/obsidian/AsyncWithNotice.ts', () => ({
  retryWithTimeoutNotice: vi.fn()
}));

vi.mock('../../src/obsidian/Editor.ts', () => ({
  lockEditor: vi.fn(),
  unlockEditor: vi.fn()
}));

vi.mock('../../src/obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((fn: (messages: Record<string, unknown>) => unknown) => {
    try {
      fn(castTo<Record<string, unknown>>({ obsidianDevUtils: { vault: { processFile: 'mock' } } }));
    } catch { /* Ignore */ }
    return 'mock-t';
  })
}));

vi.mock('../../src/Debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

const mockedRetryWithTimeoutNotice = vi.mocked(retryWithTimeoutNotice);
let app: App;

beforeEach(() => {
  app = createMockApp();
});

describe('isChild', () => {
  it('should return false when both paths are the same', () => {
    expect(isChild(app, 'folder/note.md', 'folder/note.md')).toBe(false);
  });

  it('should return true when b is root "/"', () => {
    const root = createTFolderInstance(app, '/');
    setVaultAbstractFile(app.vault, '/', root);
    expect(isChild(app, 'folder/note.md', root)).toBe(true);
  });

  it('should return true when a is inside b', () => {
    expect(isChild(app, 'folder/subfolder/note.md', 'folder')).toBe(true);
  });

  it('should return false when a is not inside b', () => {
    expect(isChild(app, 'other/note.md', 'folder')).toBe(false);
  });

  it('should return false when a only starts with b but not as a folder', () => {
    expect(isChild(app, 'folderExtra/note.md', 'folder')).toBe(false);
  });

  it('should work with TAbstractFile instances', () => {
    const fileA = createTFileInstance(app, 'parent/child.md');
    const folderB = createTFolderInstance(app, 'parent');
    setVaultAbstractFile(app.vault, 'parent/child.md', fileA);
    setVaultAbstractFile(app.vault, 'parent', folderB);
    expect(isChild(app, fileA, folderB)).toBe(true);
  });
});

describe('isChildOrSelf', () => {
  it('should return true when both paths are the same', () => {
    expect(isChildOrSelf(app, 'folder/note.md', 'folder/note.md')).toBe(true);
  });

  it('should return true when a is a child of b', () => {
    expect(isChildOrSelf(app, 'folder/subfolder/note.md', 'folder')).toBe(true);
  });

  it('should return false when a is not a child or self of b', () => {
    expect(isChildOrSelf(app, 'other/note.md', 'folder')).toBe(false);
  });

  it('should return true when both refer to root', () => {
    const rootA = createTFolderInstance(app, '/');
    const rootB = createTFolderInstance(app, '/');
    setVaultAbstractFile(app.vault, '/', rootA);
    expect(isChildOrSelf(app, rootA, rootB)).toBe(true);
  });
});

describe('getAvailablePath', () => {
  it('should call vault.getAvailablePath with correct base and extension', () => {
    vi.spyOn(app.vault, 'getAvailablePath');
    getAvailablePath(app, 'folder/note.md');
    expect(vi.mocked(app.vault.getAvailablePath)).toHaveBeenCalledWith('folder/note', 'md');
  });

  it('should handle paths with no extension', () => {
    vi.spyOn(app.vault, 'getAvailablePath');
    getAvailablePath(app, 'folder/readme');
    expect(vi.mocked(app.vault.getAvailablePath)).toHaveBeenCalledWith('folder/readme', '');
  });

  it('should handle paths with multiple dots', () => {
    vi.spyOn(app.vault, 'getAvailablePath');
    getAvailablePath(app, 'folder/my.note.md');
    expect(vi.mocked(app.vault.getAvailablePath)).toHaveBeenCalledWith('folder/my.note', 'md');
  });

  it('should return the value from vault.getAvailablePath', () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('folder/note 1');
    const result = getAvailablePath(app, 'folder/note.md');
    expect(result).toBe('folder/note 1');
  });
});

describe('getMarkdownFilesSorted', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [
        { path: 'z-note.md' },
        { path: 'a-note.md' },
        { path: 'folder/m-note.md' }
      ]
    });
  });

  it('should return markdown files sorted by path', () => {
    const files = getMarkdownFilesSorted(app);
    expect(files.map((f) => f.path)).toEqual([
      'a-note.md',
      'folder/m-note.md',
      'z-note.md'
    ]);
  });

  it('should return empty array when no markdown files exist', () => {
    app = createMockApp();
    const files = getMarkdownFilesSorted(app);
    expect(files).toEqual([]);
  });
});

describe('getNoteFilesSorted', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [
        { path: 'z-note.md' },
        { path: 'a-note.md' },
        { extension: 'canvas', path: 'drawing.canvas' },
        { extension: 'json', path: 'data.json' }
      ],
      folders: ['subfolder']
    });
  });

  it('should return note files (md, canvas) sorted by path, excluding non-notes', () => {
    const files = getNoteFilesSorted(app);
    const paths = files.map((f) => f.path);
    // IsNote returns true for md, canvas, and base extension files
    expect(paths).toContain('a-note.md');
    expect(paths).toContain('z-note.md');
    expect(paths).toContain('drawing.canvas');
  });

  it('should not include folders', () => {
    const files = getNoteFilesSorted(app);
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain('subfolder');
  });

  it('should return sorted results', () => {
    const files = getNoteFilesSorted(app);
    const paths = files.map((f) => f.path);
    const sorted = [...paths].sort();
    expect(paths).toEqual(sorted);
  });
});

describe('createFolderSafe', () => {
  it('should return false if folder already exists', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(true);
    const result = await createFolderSafe(app, 'existing-folder');
    expect(result).toBe(false);
  });

  it('should create folder and return true when it does not exist', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'createFolder');
    const result = await createFolderSafe(app, 'new-folder');
    expect(result).toBe(true);
    expect(vi.mocked(app.vault.createFolder)).toHaveBeenCalledWith('new-folder');
  });

  it('should return true if createFolder fails but folder now exists', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'createFolder').mockRejectedValue(new Error('Folder already exists'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(true);
    const result = await createFolderSafe(app, 'race-condition-folder');
    expect(result).toBe(true);
  });

  it('should throw if createFolder fails and folder does not exist', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'createFolder').mockRejectedValue(new Error('Disk full'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(false);
    await expect(createFolderSafe(app, 'failed-folder')).rejects.toThrow('Disk full');
  });
});

describe('copySafe', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'source.md' }]
    });
  });

  it('should return same path when old and new paths are the same', async () => {
    const result = await copySafe(app, 'source.md', 'source.md');
    expect(result).toBe('source.md');
  });

  it('should copy file to new path', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'copy');
    const result = await copySafe(app, 'source.md', 'dest/target.md');
    expect(vi.mocked(app.vault.copy)).toHaveBeenCalled();
    expect(typeof result).toBe('string');
  });

  it('should create parent folder before copying', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'createFolder');
    await copySafe(app, 'source.md', 'newdir/target.md');
    expect(vi.mocked(app.vault.createFolder)).toHaveBeenCalled();
  });

  it('should return available path if copy succeeds', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('dest/target 1');
    const result = await copySafe(app, 'source.md', 'dest/target.md');
    expect(result).toBe('dest/target 1');
  });

  it('should not throw if copy fails but file exists at new path', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'copy').mockRejectedValue(new Error('Copy failed'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(true);
    const result = await copySafe(app, 'source.md', 'dest/target.md');
    expect(typeof result).toBe('string');
  });

  it('should throw if copy fails and file does not exist at new path', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'copy').mockRejectedValue(new Error('Copy failed'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(false);
    await expect(copySafe(app, 'source.md', 'dest/target.md')).rejects.toThrow('Copy failed');
  });

  it('should work with TFile instances', async () => {
    const file = app.vault.getFileByPath('source.md');
    assertNonNullable(file);
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    const result = await copySafe(app, file, 'dest/copy.md');
    expect(typeof result).toBe('string');
  });
});

describe('readSafe', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ content: 'hello world', path: 'note.md' }]
    });
  });

  it('should return file content when file exists', async () => {
    const content = await readSafe(app, 'note.md');
    expect(content).toBe('hello world');
  });

  it('should return null when file does not exist', async () => {
    const content = await readSafe(app, 'nonexistent.md');
    expect(content).toBeNull();
  });

  it('should work with TFile instances', async () => {
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    const content = await readSafe(app, file);
    expect(content).toBe('hello world');
  });
});

describe('getAbstractFilePathSafe', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'existing.md' }],
      folders: ['existing-folder']
    });
  });

  it('should return path when file exists and type matches File', () => {
    const result = getAbstractFilePathSafe(app, 'existing.md', FileSystemType.File);
    expect(result).toBe('existing.md');
  });

  it('should return path when folder exists and type matches Folder', () => {
    const result = getAbstractFilePathSafe(app, 'existing-folder', FileSystemType.Folder);
    expect(result).toBe('existing-folder');
  });

  it('should return available path when file does not exist', () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('nonexistent 1');
    const result = getAbstractFilePathSafe(app, 'nonexistent.md', FileSystemType.File);
    expect(result).toBe('nonexistent 1');
  });

  it('should return available path when type does not match', () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('existing');
    // Existing.md is a File, but we ask for Folder type
    const result = getAbstractFilePathSafe(app, 'existing.md', FileSystemType.Folder);
    expect(result).toBe('existing');
  });
});

describe('getFilePathSafe', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'test.md' }]
    });
  });

  it('should return path when file exists', () => {
    const result = getFilePathSafe(app, 'test.md');
    expect(result).toBe('test.md');
  });

  it('should return available path when file does not exist', () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('missing 1');
    const result = getFilePathSafe(app, 'missing.md');
    expect(result).toBe('missing 1');
  });
});

describe('getFolderPathSafe', () => {
  beforeEach(() => {
    app = createMockApp({
      folders: ['my-folder']
    });
  });

  it('should return path when folder exists', () => {
    const result = getFolderPathSafe(app, 'my-folder');
    expect(result).toBe('my-folder');
  });

  it('should return available path when folder does not exist', () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('other-folder');
    const result = getFolderPathSafe(app, 'other-folder');
    expect(result).toBe('other-folder');
  });
});

describe('saveNote', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'note.md' }]
    });
  });

  it('should not save if file is not a markdown file', async () => {
    const nonMdFile = createTFileInstance(app, 'data.json');
    setVaultAbstractFile(app.vault, 'data.json', nonMdFile);
    vi.spyOn(app.workspace, 'getLeavesOfType');
    await saveNote(app, 'data.json');
    expect(vi.mocked(app.workspace.getLeavesOfType)).not.toHaveBeenCalled();
  });

  it('should save dirty markdown views matching the file path', async () => {
    const view = new (castTo<new () => MarkdownView>(MarkdownView))();
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    view.file = file;
    castTo<Record<string, unknown>>(view)['dirty'] = true;
    vi.spyOn(view, 'save');

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);

    await saveNote(app, 'note.md');
    expect(vi.mocked(view.save)).toHaveBeenCalled();
  });

  it('should not save non-dirty views', async () => {
    const view = new (castTo<new () => MarkdownView>(MarkdownView))();
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    view.file = file;
    castTo<Record<string, unknown>>(view)['dirty'] = false;
    vi.spyOn(view, 'save');

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);

    await saveNote(app, 'note.md');
    expect(vi.mocked(view.save)).not.toHaveBeenCalled();
  });

  it('should not save views for different file paths', async () => {
    const view = new (castTo<new () => MarkdownView>(MarkdownView))();
    view.file = createTFileInstance(app, 'other.md');
    castTo<Record<string, unknown>>(view)['dirty'] = true;
    vi.spyOn(view, 'save');

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);

    await saveNote(app, 'note.md');
    expect(vi.mocked(view.save)).not.toHaveBeenCalled();
  });
});

describe('isEmptyFolder', () => {
  beforeEach(() => {
    app = createMockApp({
      folders: ['empty-folder', 'full-folder']
    });
  });

  it('should return true for an empty folder', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({ files: [], folders: [] });
    const result = await isEmptyFolder(app, 'empty-folder');
    expect(result).toBe(true);
  });

  it('should return false for a folder with files', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({ files: ['full-folder/note.md'], folders: [] });
    const result = await isEmptyFolder(app, 'full-folder');
    expect(result).toBe(false);
  });

  it('should return false for a folder with subfolders', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({ files: [], folders: ['full-folder/sub'] });
    const result = await isEmptyFolder(app, 'full-folder');
    expect(result).toBe(false);
  });

  it('should return true for a path that is not a folder', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue(null);
    const result = await isEmptyFolder(app, 'nonexistent');
    expect(result).toBe(true);
  });

  it('should work with TFolder instances', async () => {
    const folder = app.vault.getFolderByPath('empty-folder');
    assertNonNullable(folder);
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({ files: [], folders: [] });
    const result = await isEmptyFolder(app, folder);
    expect(result).toBe(true);
  });
});

describe('listSafe', () => {
  beforeEach(() => {
    app = createMockApp({
      folders: ['my-folder']
    });
  });

  it('should return empty when path is not a folder', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue(null);
    const result = await listSafe(app, 'nonexistent');
    expect(result).toEqual({ files: [], folders: [] });
  });

  it('should return empty when stat type is not folder', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 100, type: 'file' });
    const result = await listSafe(app, 'some-file.md');
    expect(result).toEqual({ files: [], folders: [] });
  });

  it('should return listed files when path is a folder', async () => {
    const listed = { files: ['my-folder/a.md', 'my-folder/b.md'], folders: ['my-folder/sub'] };
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue(listed);
    const result = await listSafe(app, 'my-folder');
    expect(result).toEqual(listed);
  });

  it('should return empty if list throws and folder no longer exists', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockRejectedValue(new Error('IO error'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(false);
    const result = await listSafe(app, 'my-folder');
    expect(result).toEqual({ files: [], folders: [] });
  });

  it('should throw if list throws and folder still exists', async () => {
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockRejectedValue(new Error('Permission denied'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(true);
    await expect(listSafe(app, 'my-folder')).rejects.toThrow('Permission denied');
  });

  it('should work with TFolder instances', async () => {
    const folder = app.vault.getFolderByPath('my-folder');
    assertNonNullable(folder);
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({ files: ['my-folder/x.md'], folders: [] });
    const result = await listSafe(app, folder);
    expect(result).toEqual({ files: ['my-folder/x.md'], folders: [] });
  });
});

describe('getSafeRenamePath', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'old.md' }]
    });
  });

  it('should return available path when paths differ (case-sensitive)', () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new');
    const result = getSafeRenamePath(app, 'old.md', 'new.md');
    expect(result).toBe('new');
  });

  it('should return newPath directly when only case differs (case-sensitive filesystem)', () => {
    // OldPath.toLowerCase() === newPath.toLowerCase(), so returns newPath directly
    const result = getSafeRenamePath(app, 'old.md', 'Old.md');
    expect(result).toBe('Old.md');
  });

  it('should return newPath directly when paths match case-insensitively on insensitive filesystem', () => {
    app.vault.adapter.insensitive = true;
    // Need a parent folder for the while loop to find
    const parentFolder = createTFolderInstance(app, 'dir');
    castTo<Record<string, unknown>>(parentFolder)['getParentPrefix'] = (): string => 'dir/';
    setVaultAbstractFile(app.vault, 'dir', parentFolder);

    const dirFile = createTFileInstance(app, 'dir/old.md');
    setVaultAbstractFile(app.vault, 'dir/old.md', dirFile);

    const result = getSafeRenamePath(app, 'dir/old.md', 'dir/OLD.md');
    expect(result).toBe('dir/OLD.md');
  });

  it('should handle insensitive filesystem with nested path by walking up to existing folder', () => {
    app.vault.adapter.insensitive = true;
    const parentFolder = createTFolderInstance(app, 'parent');
    castTo<Record<string, unknown>>(parentFolder)['getParentPrefix'] = (): string => 'parent/';
    setVaultAbstractFile(app.vault, 'parent', parentFolder);

    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('parent/sub/new');
    const result = getSafeRenamePath(app, 'old.md', 'parent/sub/new.md');
    expect(result).toBe('parent/sub/new');
  });
});

describe('renameSafe', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'source.md' }]
    });
  });

  it('should not rename if old and new paths are the same', async () => {
    vi.spyOn(app.fileManager, 'renameFile');
    const result = await renameSafe(app, 'source.md', 'source.md');
    expect(vi.mocked(app.fileManager.renameFile)).not.toHaveBeenCalled();
    expect(result).toBe('source.md');
  });

  it('should rename when case differs (case rename)', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('Source.md');
    vi.spyOn(app.fileManager, 'renameFile');
    const result = await renameSafe(app, 'source.md', 'Source.md');
    // Source.md and Source.md differ in case, so lowercase compare matches
    // GetSafeRenamePath returns getAvailablePath result
    // Then oldAbstractFile.path.toLowerCase() === newAvailablePath.toLowerCase() is checked
    expect(result).toBe('Source.md');
    expect(vi.mocked(app.fileManager.renameFile)).toHaveBeenCalled();
  });

  it('should create parent folder for new path', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('dest/target');
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.vault, 'createFolder');
    await renameSafe(app, 'source.md', 'dest/target.md');
    expect(vi.mocked(app.vault.createFolder)).toHaveBeenCalled();
  });

  it('should not throw if rename fails but file exists at new path and not at old', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('dest/target');
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.fileManager, 'renameFile').mockRejectedValue(new Error('Rename failed'));
    vi.spyOn(app.vault, 'exists')
      .mockResolvedValueOnce(true) // NewAvailablePath exists
      .mockResolvedValueOnce(false); // OldPath doesn't exist
    const result = await renameSafe(app, 'source.md', 'dest/target.md');
    expect(result).toBe('dest/target');
  });

  it('should throw if rename fails and new path does not exist', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('dest/target');
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.fileManager, 'renameFile').mockRejectedValue(new Error('Rename failed'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(false);
    await expect(renameSafe(app, 'source.md', 'dest/target.md')).rejects.toThrow('Rename failed');
  });

  it('should throw if rename fails and old path still exists', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('dest/target');
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.fileManager, 'renameFile').mockRejectedValue(new Error('Rename failed'));
    vi.spyOn(app.vault, 'exists')
      .mockResolvedValueOnce(true) // NewAvailablePath exists
      .mockResolvedValueOnce(true); // OldPath still exists
    await expect(renameSafe(app, 'source.md', 'dest/target.md')).rejects.toThrow('Rename failed');
  });
});

describe('getOrCreateAbstractFileSafe', () => {
  it('should return existing file if it exists', async () => {
    const file = createTFileInstance(app, 'existing.md');
    setVaultAbstractFile(app.vault, 'existing.md', file);
    const result = await getOrCreateAbstractFileSafe(app, 'existing.md', FileSystemType.File);
    expect(result.path).toBe('existing.md');
  });

  it('should create a new file when it does not exist', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new-file');
    vi.spyOn(app.vault, 'create');
    const result = await getOrCreateAbstractFileSafe(app, 'new-file.md', FileSystemType.File);
    expect(vi.mocked(app.vault.create)).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should return existing folder if it exists', async () => {
    const folder = createTFolderInstance(app, 'existing-folder');
    setVaultAbstractFile(app.vault, 'existing-folder', folder);
    const result = await getOrCreateAbstractFileSafe(app, 'existing-folder', FileSystemType.Folder);
    expect(result.path).toBe('existing-folder');
  });

  it('should create a new folder when it does not exist', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new-folder');
    vi.spyOn(app.vault, 'createFolder');
    const result = await getOrCreateAbstractFileSafe(app, 'new-folder', FileSystemType.Folder);
    expect(vi.mocked(app.vault.createFolder)).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should throw for invalid file system type', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('path');
    await expect(
      getOrCreateAbstractFileSafe(app, 'path', castTo<FileSystemType>('invalid'))
    ).rejects.toThrow('Invalid file system type');
  });
});

describe('getOrCreateFileSafe', () => {
  it('should return existing file', async () => {
    const file = createTFileInstance(app, 'test.md');
    setVaultAbstractFile(app.vault, 'test.md', file);
    const result = await getOrCreateFileSafe(app, 'test.md');
    expect(result.path).toBe('test.md');
  });

  it('should create file when not found', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new');
    vi.spyOn(app.vault, 'create');
    await getOrCreateFileSafe(app, 'new.md');
    expect(vi.mocked(app.vault.create)).toHaveBeenCalled();
  });
});

describe('getOrCreateFolderSafe', () => {
  it('should return existing folder', async () => {
    const folder = createTFolderInstance(app, 'test-folder');
    setVaultAbstractFile(app.vault, 'test-folder', folder);
    const result = await getOrCreateFolderSafe(app, 'test-folder');
    expect(result.path).toBe('test-folder');
  });

  it('should create folder when not found', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new-folder');
    vi.spyOn(app.vault, 'createFolder');
    await getOrCreateFolderSafe(app, 'new-folder');
    expect(vi.mocked(app.vault.createFolder)).toHaveBeenCalled();
  });
});

describe('invokeWithFileSystemLock', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'locked.md' }]
    });
  });

  it('should call the function with the file content', async () => {
    const fn = vi.fn();
    await invokeWithFileSystemLock(app, 'locked.md', fn);
    expect(fn).toHaveBeenCalledWith('');
  });

  it('should call vault.process with the file', async () => {
    vi.spyOn(app.vault, 'process');
    await invokeWithFileSystemLock(app, 'locked.md', vi.fn());
    expect(vi.mocked(app.vault.process)).toHaveBeenCalled();
  });

  it('should work with TFile instances', async () => {
    const file = app.vault.getFileByPath('locked.md');
    assertNonNullable(file);
    const fn = vi.fn();
    await invokeWithFileSystemLock(app, file, fn);
    expect(fn).toHaveBeenCalled();
  });

  it('should return the content unchanged after fn is called', async () => {
    vi.spyOn(app.vault, 'process');
    await invokeWithFileSystemLock(app, 'locked.md', vi.fn());
    // The process function should return the same content
    const call = vi.mocked(app.vault.process).mock.calls[0];
    expect(call).toBeDefined();
    if (call) {
      const processFn = call[1] as (data: string) => string;
      expect(processFn('test content')).toBe('test content');
    }
  });
});

describe('readSafe error paths (invokeFileActionSafe catch)', () => {
  beforeEach(() => {
    app = createMockApp({
      files: [{ content: 'hello', path: 'note.md' }]
    });
  });

  it('should return null when read throws and file is subsequently deleted', async () => {
    vi.spyOn(app.vault, 'read').mockImplementation(async () => {
      // Simulate file being deleted during read
      deleteVaultAbstractFile(app.vault, 'note.md');
      throw new Error('File deleted');
    });

    const content = await readSafe(app, 'note.md');
    expect(content).toBeNull();
  });

  it('should rethrow when read throws and file still exists', async () => {
    vi.spyOn(app.vault, 'read').mockRejectedValue(new Error('Disk error'));

    await expect(readSafe(app, 'note.md')).rejects.toThrow('Disk error');
  });
});

describe('createTempFile', () => {
  beforeEach(() => {
    // Map '' to root folder so createTempFolder recursion terminates
    const root = app.vault.getFolderByPath('/');
    assertNonNullable(root);
    setVaultAbstractFile(app.vault, '', root);
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(true);
  });

  it('should return noopAsync when file already exists', async () => {
    app = createMockApp({ files: [{ path: 'existing.md' }] });
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(true);
    const cleanup = await createTempFile(app, 'existing.md');
    await expect(cleanup()).resolves.toBeUndefined();
  });

  it('should create file and return cleanup function', async () => {
    vi.spyOn(app.vault, 'create');
    const cleanup = await createTempFile(app, 'new.md');
    expect(vi.mocked(app.vault.create)).toHaveBeenCalledWith('new.md', '');
    expect(typeof cleanup).toBe('function');
  });

  it('should not throw when vault.create fails but file now exists', async () => {
    vi.spyOn(app.vault, 'create').mockRejectedValue(new Error('Already exists'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(true);
    const cleanup = await createTempFile(app, 'race.md');
    expect(typeof cleanup).toBe('function');
  });

  it('should throw when vault.create fails and file does not exist', async () => {
    vi.spyOn(app.vault, 'create').mockRejectedValue(new Error('Disk full'));
    vi.spyOn(app.vault, 'exists').mockResolvedValue(false);
    await expect(createTempFile(app, 'fail.md')).rejects.toThrow('Disk full');
  });

  it('cleanup should trash non-deleted file', async () => {
    const createdFile = createTFileInstance(app, 'new.md');
    vi.spyOn(app.vault, 'create').mockResolvedValue(createdFile);
    vi.spyOn(app.fileManager, 'trashFile');

    const cleanup = await createTempFile(app, 'new.md');

    // Set up the file in fileMap for cleanup to find it

    setVaultAbstractFile(app.vault, 'new.md', createdFile);
    await cleanup();
    expect(vi.mocked(app.fileManager.trashFile)).toHaveBeenCalledWith(createdFile);
  });

  it('cleanup should not trash deleted file', async () => {
    const createdFile = createTFileInstance(app, 'new.md');
    vi.spyOn(app.vault, 'create').mockResolvedValue(createdFile);
    vi.spyOn(app.fileManager, 'trashFile');

    const cleanup = await createTempFile(app, 'new.md');

    // Put file in fileMap but mark as deleted
    setVaultAbstractFile(app.vault, 'new.md', createdFile);
    createdFile.deleted = true;
    await cleanup();
    expect(vi.mocked(app.fileManager.trashFile)).not.toHaveBeenCalled();
  });
});

describe('createTempFolder', () => {
  beforeEach(() => {
    // Map '' to root folder so createTempFolder recursion terminates
    const root = app.vault.getFolderByPath('/');
    assertNonNullable(root);
    setVaultAbstractFile(app.vault, '', root);
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(true);
  });

  it('should return noopAsync when folder already exists', async () => {
    app = createMockApp({ folders: ['existing'] });
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(true);
    const cleanup = await createTempFolder(app, 'existing');
    await expect(cleanup()).resolves.toBeUndefined();
  });

  it('should create folder and return cleanup function', async () => {
    vi.spyOn(app.vault, 'createFolder');
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);

    const cleanup = await createTempFolder(app, 'new-folder');
    expect(vi.mocked(app.vault.createFolder)).toHaveBeenCalledWith('new-folder');
    expect(typeof cleanup).toBe('function');
  });

  it('cleanup should trash non-deleted folder', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.fileManager, 'trashFile');

    const cleanup = await createTempFolder(app, 'temp');

    // Set up the folder in fileMap for cleanup to find it
    const folder = createTFolderInstance(app, 'temp');

    setVaultAbstractFile(app.vault, 'temp', folder);
    await cleanup();
    expect(vi.mocked(app.fileManager.trashFile)).toHaveBeenCalledWith(folder);
  });

  it('cleanup should not trash deleted folder', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    vi.spyOn(app.fileManager, 'trashFile');

    const cleanup = await createTempFolder(app, 'temp');

    const folder = createTFolderInstance(app, 'temp');
    setVaultAbstractFile(app.vault, 'temp', folder);
    folder.deleted = true;
    await cleanup();
    expect(vi.mocked(app.fileManager.trashFile)).not.toHaveBeenCalled();
  });
});

describe('processFile', () => {
  function setupRetryToInvokeOperationFn(): void {
    mockedRetryWithTimeoutNotice.mockImplementation(async (options: RetryWithTimeoutNoticeOptions) => {
      const operationFn = options.operationFn;
      const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
      await operationFn(abortSignal);
    });
  }

  beforeEach(() => {
    app = createMockApp({
      files: [{ content: 'old content', path: 'note.md' }]
    });
    mockedRetryWithTimeoutNotice.mockReset();
  });

  it('should call retryWithTimeoutNotice with correct options', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);
    await processFile(app, 'note.md', 'new content');

    expect(mockedRetryWithTimeoutNotice).toHaveBeenCalledOnce();
    const callArg = mockedRetryWithTimeoutNotice.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(callArg?.['shouldShowTimeoutNotice']).toBe(true);
  });

  it('should pass shouldShowTimeoutNotice from options', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);
    await processFile(app, 'note.md', 'new content', { shouldShowTimeoutNotice: false });

    const callArg = mockedRetryWithTimeoutNotice.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(callArg?.['shouldShowTimeoutNotice']).toBe(false);
  });

  it('should write new content when content matches', async () => {
    setupRetryToInvokeOperationFn();
    // Vault.read returns 'old content', vault.process calls fn with '' by default
    // We need vault.process to call fn with the same content readSafe returns
    vi.spyOn(app.vault, 'process').mockImplementation(async (_file, fn) => {
      return fn('old content');
    });

    await processFile(app, 'note.md', 'new content');

    expect(vi.mocked(app.vault.process)).toHaveBeenCalled();
  });

  it('should return false when content changed between read and write', async () => {
    let operationResult: boolean | undefined;
    mockedRetryWithTimeoutNotice.mockImplementation(async (options: RetryWithTimeoutNoticeOptions) => {
      const operationFn = options.operationFn;
      const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
      operationResult = await operationFn(abortSignal);
    });
    // Vault.read returns 'old content' but vault.process sees 'changed content'
    vi.spyOn(app.vault, 'process').mockImplementation(async (_file, fn) => {
      return fn('changed content');
    });

    await processFile(app, 'note.md', 'new content');
    expect(operationResult).toBe(false);
  });

  it('should throw when file is missing and shouldFailOnMissingFile is true', async () => {
    setupRetryToInvokeOperationFn();

    await expect(processFile(app, 'missing.md', 'content', { shouldFailOnMissingFile: true }))
      .rejects.toThrow('File \'missing.md\' not found');
  });

  it('should succeed when file is missing and shouldFailOnMissingFile is false', async () => {
    setupRetryToInvokeOperationFn();
    app = createMockApp(); // No files

    await expect(processFile(app, 'missing.md', 'content', { shouldFailOnMissingFile: false }))
      .resolves.toBeUndefined();
  });

  it('should return false when newContentProvider returns null', async () => {
    let operationResult: boolean | undefined;
    mockedRetryWithTimeoutNotice.mockImplementation(async (options: RetryWithTimeoutNoticeOptions) => {
      const operationFn = options.operationFn;
      const abortSignal = castTo<AbortSignal>({ throwIfAborted: vi.fn() });
      operationResult = await operationFn(abortSignal);
    });

    await processFile(app, 'note.md', () => null);
    expect(operationResult).toBe(false);
  });

  it('should handle doesFileExist being false after readSafe succeeds', async () => {
    setupRetryToInvokeOperationFn();

    // ReadSafe succeeds, but file disappears before the second invokeFileActionSafe
    vi.spyOn(app.vault, 'read').mockImplementation(async () => {
      // Delete file during read so subsequent getFileOrNull returns null
      deleteVaultAbstractFile(app.vault, 'note.md');
      return 'old content';
    });

    await expect(processFile(app, 'note.md', 'new content'))
      .rejects.toThrow('File \'note.md\' not found');
  });

  it('should lock and unlock editors when shouldLockEditorWhileProcessing is true', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    const view = new (castTo<new () => MarkdownView>(MarkdownView))();
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    view.file = file;
    castTo<Record<string, unknown>>(view)['editor'] = {};

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);
    vi.spyOn(app.workspace, 'on');

    await processFile(app, 'note.md', 'new content', { shouldLockEditorWhileProcessing: true });

    expect(vi.mocked(app.workspace.on)).toHaveBeenCalledWith('active-leaf-change', expect.any(Function));
  });

  it('should invoke active-leaf-change callback that locks matching editors', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    const view = new (castTo<new () => MarkdownView>(MarkdownView))();
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    view.file = file;
    castTo<Record<string, unknown>>(view)['editor'] = {};

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);

    let capturedCallback: ((leaf: unknown) => void) | undefined;
    vi.spyOn(app.workspace, 'on').mockImplementation((_name: string, callback: (...data: unknown[]) => unknown, _ctx?: unknown) => {
      capturedCallback = callback as (leaf: unknown) => void;
      return { e: app.workspace, fn: callback, name: _name } as never;
    });

    await processFile(app, 'note.md', 'new content', { shouldLockEditorWhileProcessing: true });

    assertNonNullable(capturedCallback);
    // Invoke the callback with a matching leaf
    const mockedLockEditor = vi.mocked(lockEditor);
    mockedLockEditor.mockClear();
    capturedCallback({ view });
    expect(mockedLockEditor).toHaveBeenCalledTimes(1);
    expect(mockedLockEditor).toHaveBeenCalledWith(view.editor);
    // Also invoke with null leaf for branch coverage
    mockedLockEditor.mockClear();
    capturedCallback(null);
    expect(mockedLockEditor).not.toHaveBeenCalled();
  });

  it('should not lock editors when shouldLockEditorWhileProcessing is false', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    vi.spyOn(app.workspace, 'on');

    await processFile(app, 'note.md', 'new content', { shouldLockEditorWhileProcessing: false });

    expect(vi.mocked(app.workspace.on)).not.toHaveBeenCalled();
  });

  it('should clean up event ref in finally block', async () => {
    mockedRetryWithTimeoutNotice.mockRejectedValue(new Error('Timeout'));

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
    vi.spyOn(app.workspace, 'on');

    await expect(processFile(app, 'note.md', 'new content')).rejects.toThrow('Timeout');

    expect(vi.mocked(app.workspace.on)).toHaveBeenCalled();
  });

  it('should skip locking editors when view.file is null', async () => {
    mockedRetryWithTimeoutNotice.mockResolvedValue(undefined);

    const view = new (castTo<new () => MarkdownView>(MarkdownView))();
    // View.file defaults to null in the mock — don't set it
    castTo<Record<string, unknown>>(view)['editor'] = {};

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);

    const mockedLockEditor = vi.mocked(lockEditor);
    mockedLockEditor.mockClear();

    await processFile(app, 'note.md', 'new content', { shouldLockEditorWhileProcessing: true });

    expect(mockedLockEditor).not.toHaveBeenCalled();
  });
});
