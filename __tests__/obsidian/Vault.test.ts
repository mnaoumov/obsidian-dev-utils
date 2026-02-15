import type { App } from 'obsidian';
// @vitest-environment jsdom

import {
  MarkdownView,
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

import { createMockApp } from '../../__mocks__/obsidian/App.ts';
import { FileSystemType } from '../../src/obsidian/FileSystem.ts';
import {
  copySafe,
  createFolderSafe,
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
  readSafe,
  renameSafe,
  saveNote
} from '../../src/obsidian/Vault.ts';
import { assertNotNullable } from '../TestHelpers.ts';

function createTestFile(path: string, ext = 'md'): TFile {
  const file = new TFile();
  file.path = path;
  const parts = path.split('/');
  file.name = parts[parts.length - 1] ?? '';
  file.extension = ext;
  file.basename = file.name.replace(`.${ext}`, '');
  return file;
}

function createTestFolder(path: string): TFolder {
  const folder = new TFolder();
  folder.path = path;
  const parts = path.split('/');
  folder.name = parts[parts.length - 1] ?? '';
  return folder;
}

describe('isChild', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should return false when both paths are the same', () => {
    expect(isChild(app, 'folder/note.md', 'folder/note.md')).toBe(false);
  });

  it('should return true when b is root "/"', () => {
    const root = createTestFolder('/');
    app.vault.fileMap['/'] = root;
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
    const fileA = createTestFile('parent/child.md');
    const folderB = createTestFolder('parent');
    app.vault.fileMap['parent/child.md'] = fileA;
    app.vault.fileMap['parent'] = folderB;
    expect(isChild(app, fileA, folderB)).toBe(true);
  });
});

describe('isChildOrSelf', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

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
    const rootA = createTestFolder('/');
    const rootB = createTestFolder('/');
    app.vault.fileMap['/'] = rootA;
    expect(isChildOrSelf(app, rootA, rootB)).toBe(true);
  });
});

describe('getAvailablePath', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should call vault.getAvailablePath with correct base and extension', () => {
    const spy = vi.spyOn(app.vault, 'getAvailablePath');
    getAvailablePath(app, 'folder/note.md');
    expect(spy).toHaveBeenCalledWith('folder/note', 'md');
  });

  it('should handle paths with no extension', () => {
    const spy = vi.spyOn(app.vault, 'getAvailablePath');
    getAvailablePath(app, 'folder/readme');
    expect(spy).toHaveBeenCalledWith('folder/readme', '');
  });

  it('should handle paths with multiple dots', () => {
    const spy = vi.spyOn(app.vault, 'getAvailablePath');
    getAvailablePath(app, 'folder/my.note.md');
    expect(spy).toHaveBeenCalledWith('folder/my.note', 'md');
  });

  it('should return the value from vault.getAvailablePath', () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('folder/note 1');
    const result = getAvailablePath(app, 'folder/note.md');
    expect(result).toBe('folder/note 1');
  });
});

describe('getMarkdownFilesSorted', () => {
  let app: App;

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
  let app: App;

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
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should return false if folder already exists', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(true);
    const result = await createFolderSafe(app, 'existing-folder');
    expect(result).toBe(false);
  });

  it('should create folder and return true when it does not exist', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    const spy = vi.spyOn(app.vault, 'createFolder');
    const result = await createFolderSafe(app, 'new-folder');
    expect(result).toBe(true);
    expect(spy).toHaveBeenCalledWith('new-folder');
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
  let app: App;

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
    const copySpy = vi.spyOn(app.vault, 'copy');
    const result = await copySafe(app, 'source.md', 'dest/target.md');
    expect(copySpy).toHaveBeenCalled();
    expect(typeof result).toBe('string');
  });

  it('should create parent folder before copying', async () => {
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    const createFolderSpy = vi.spyOn(app.vault, 'createFolder');
    await copySafe(app, 'source.md', 'newdir/target.md');
    expect(createFolderSpy).toHaveBeenCalled();
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
    assertNotNullable(file);
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    const result = await copySafe(app, file, 'dest/copy.md');
    expect(typeof result).toBe('string');
  });
});

describe('readSafe', () => {
  let app: App;

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
    assertNotNullable(file);
    const content = await readSafe(app, file);
    expect(content).toBe('hello world');
  });
});

describe('getAbstractFilePathSafe', () => {
  let app: App;

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
  let app: App;

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
  let app: App;

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
  let app: App;

  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'note.md' }]
    });
  });

  it('should not save if file is not a markdown file', async () => {
    const nonMdFile = createTestFile('data.json', 'json');
    app.vault.fileMap['data.json'] = nonMdFile;
    const getLeavesOfTypeSpy = vi.spyOn(app.workspace, 'getLeavesOfType');
    await saveNote(app, 'data.json');
    expect(getLeavesOfTypeSpy).not.toHaveBeenCalled();
  });

  it('should save dirty markdown views matching the file path', async () => {
    const view = new (MarkdownView as unknown as new () => MarkdownView)();
    const file = app.vault.getFileByPath('note.md');
    assertNotNullable(file);
    view.file = file;
    (view as unknown as Record<string, unknown>)['dirty'] = true;
    const saveSpy = vi.spyOn(view, 'save');

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);

    await saveNote(app, 'note.md');
    expect(saveSpy).toHaveBeenCalled();
  });

  it('should not save non-dirty views', async () => {
    const view = new (MarkdownView as unknown as new () => MarkdownView)();
    const file = app.vault.getFileByPath('note.md');
    assertNotNullable(file);
    view.file = file;
    (view as unknown as Record<string, unknown>)['dirty'] = false;
    const saveSpy = vi.spyOn(view, 'save');

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);

    await saveNote(app, 'note.md');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('should not save views for different file paths', async () => {
    const view = new (MarkdownView as unknown as new () => MarkdownView)();
    view.file = createTestFile('other.md');
    (view as unknown as Record<string, unknown>)['dirty'] = true;
    const saveSpy = vi.spyOn(view, 'save');

    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([
      { view } as never
    ]);

    await saveNote(app, 'note.md');
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

describe('isEmptyFolder', () => {
  let app: App;

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
    assertNotNullable(folder);
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({ files: [], folders: [] });
    const result = await isEmptyFolder(app, folder);
    expect(result).toBe(true);
  });
});

describe('listSafe', () => {
  let app: App;

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
    assertNotNullable(folder);
    vi.spyOn(app.vault.adapter, 'stat').mockResolvedValue({ ctime: 0, mtime: 0, size: 0, type: 'folder' });
    vi.spyOn(app.vault.adapter, 'list').mockResolvedValue({ files: ['my-folder/x.md'], folders: [] });
    const result = await listSafe(app, folder);
    expect(result).toEqual({ files: ['my-folder/x.md'], folders: [] });
  });
});

describe('getSafeRenamePath', () => {
  let app: App;

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
    const parentFolder = createTestFolder('dir');
    (parentFolder as unknown as Record<string, unknown>)['getParentPrefix'] = (): string => 'dir/';
    app.vault.fileMap['dir'] = parentFolder;

    const dirFile = createTestFile('dir/old.md');
    app.vault.fileMap['dir/old.md'] = dirFile;

    const result = getSafeRenamePath(app, 'dir/old.md', 'dir/OLD.md');
    expect(result).toBe('dir/OLD.md');
  });

  it('should handle insensitive filesystem with nested path by walking up to existing folder', () => {
    app.vault.adapter.insensitive = true;
    const parentFolder = createTestFolder('parent');
    (parentFolder as unknown as Record<string, unknown>)['getParentPrefix'] = (): string => 'parent/';
    app.vault.fileMap['parent'] = parentFolder;

    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('parent/sub/new');
    const result = getSafeRenamePath(app, 'old.md', 'parent/sub/new.md');
    expect(result).toBe('parent/sub/new');
  });
});

describe('renameSafe', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp({
      files: [{ path: 'source.md' }]
    });
  });

  it('should not rename if old and new paths are the same', async () => {
    const renameSpy = vi.spyOn(app.fileManager, 'renameFile');
    const result = await renameSafe(app, 'source.md', 'source.md');
    expect(renameSpy).not.toHaveBeenCalled();
    expect(result).toBe('source.md');
  });

  it('should rename when case differs (case rename)', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('Source.md');
    const renameSpy = vi.spyOn(app.fileManager, 'renameFile');
    const result = await renameSafe(app, 'source.md', 'Source.md');
    // Source.md and Source.md differ in case, so lowercase compare matches
    // GetSafeRenamePath returns getAvailablePath result
    // Then oldAbstractFile.path.toLowerCase() === newAvailablePath.toLowerCase() is checked
    expect(result).toBe('Source.md');
    expect(renameSpy).toHaveBeenCalled();
  });

  it('should create parent folder for new path', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('dest/target');
    vi.spyOn(app.vault.adapter, 'exists').mockResolvedValue(false);
    const createFolderSpy = vi.spyOn(app.vault, 'createFolder');
    await renameSafe(app, 'source.md', 'dest/target.md');
    expect(createFolderSpy).toHaveBeenCalled();
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
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should return existing file if it exists', async () => {
    const file = createTestFile('existing.md');
    app.vault.fileMap['existing.md'] = file;
    const result = await getOrCreateAbstractFileSafe(app, 'existing.md', FileSystemType.File);
    expect(result.path).toBe('existing.md');
  });

  it('should create a new file when it does not exist', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new-file');
    const createSpy = vi.spyOn(app.vault, 'create');
    const result = await getOrCreateAbstractFileSafe(app, 'new-file.md', FileSystemType.File);
    expect(createSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should return existing folder if it exists', async () => {
    const folder = createTestFolder('existing-folder');
    app.vault.fileMap['existing-folder'] = folder;
    const result = await getOrCreateAbstractFileSafe(app, 'existing-folder', FileSystemType.Folder);
    expect(result.path).toBe('existing-folder');
  });

  it('should create a new folder when it does not exist', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new-folder');
    const createFolderSpy = vi.spyOn(app.vault, 'createFolder');
    const result = await getOrCreateAbstractFileSafe(app, 'new-folder', FileSystemType.Folder);
    expect(createFolderSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should throw for invalid file system type', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('path');
    await expect(
      getOrCreateAbstractFileSafe(app, 'path', 'invalid' as unknown as FileSystemType)
    ).rejects.toThrow('Invalid file system type');
  });
});

describe('getOrCreateFileSafe', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should return existing file', async () => {
    const file = createTestFile('test.md');
    app.vault.fileMap['test.md'] = file;
    const result = await getOrCreateFileSafe(app, 'test.md');
    expect(result.path).toBe('test.md');
  });

  it('should create file when not found', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new');
    const createSpy = vi.spyOn(app.vault, 'create');
    await getOrCreateFileSafe(app, 'new.md');
    expect(createSpy).toHaveBeenCalled();
  });
});

describe('getOrCreateFolderSafe', () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it('should return existing folder', async () => {
    const folder = createTestFolder('test-folder');
    app.vault.fileMap['test-folder'] = folder;
    const result = await getOrCreateFolderSafe(app, 'test-folder');
    expect(result.path).toBe('test-folder');
  });

  it('should create folder when not found', async () => {
    vi.spyOn(app.vault, 'getAvailablePath').mockReturnValue('new-folder');
    const createFolderSpy = vi.spyOn(app.vault, 'createFolder');
    await getOrCreateFolderSafe(app, 'new-folder');
    expect(createFolderSpy).toHaveBeenCalled();
  });
});

describe('invokeWithFileSystemLock', () => {
  let app: App;

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
    const processSpy = vi.spyOn(app.vault, 'process');
    await invokeWithFileSystemLock(app, 'locked.md', vi.fn());
    expect(processSpy).toHaveBeenCalled();
  });

  it('should work with TFile instances', async () => {
    const file = app.vault.getFileByPath('locked.md');
    assertNotNullable(file);
    const fn = vi.fn();
    await invokeWithFileSystemLock(app, file, fn);
    expect(fn).toHaveBeenCalled();
  });

  it('should return the content unchanged after fn is called', async () => {
    const processSpy = vi.spyOn(app.vault, 'process');
    await invokeWithFileSystemLock(app, 'locked.md', vi.fn());
    // The process function should return the same content
    const call = processSpy.mock.calls[0];
    expect(call).toBeDefined();
    if (call) {
      const processFn = call[1] as (data: string) => string;
      expect(processFn('test content')).toBe('test content');
    }
  });
});
