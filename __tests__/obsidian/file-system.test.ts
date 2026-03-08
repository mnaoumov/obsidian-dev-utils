import {
  App,
  TAbstractFile,
  TFile,
  TFolder
} from 'obsidian';
// @vitest-environment jsdom
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { createTFileInstance } from '../../__mocks__/obsidian-typings/implementations/createTFileInstance.ts';
import { createTFolderInstance } from '../../__mocks__/obsidian-typings/implementations/createTFolderInstance.ts';
import { createMockApp } from '../../__mocks__/obsidian/App.ts';
import { castTo } from '../../src/object-utils.ts';
import {
  asArrayOfFiles,
  asArrayOfFolders,
  asFile,
  asFileOrNull,
  asFolder,
  asFolderOrNull,
  BASE_FILE_EXTENSION,
  CANVAS_FILE_EXTENSION,
  checkExtension,
  exists,
  FileSystemType,
  getAbstractFile,
  getAbstractFileOrNull,
  getFile,
  getFileOrNull,
  getFileSystemType,
  getFolder,
  getFolderOrNull,
  getMarkdownFiles,
  getOrCreateFile,
  getOrCreateFolder,
  getPath,
  isAbstractFile,
  isBaseFile,
  isCanvasFile,
  isFile,
  isFolder,
  isMarkdownFile,
  isNote,
  MARKDOWN_FILE_EXTENSION,
  trimMarkdownExtension
} from '../../src/obsidian/file-system.ts';
import { assertNonNullable } from '../../src/type-guards.ts';

let app: App;

beforeEach(() => {
  app = createMockApp();
});

describe('constants', () => {
  it('should export the correct MARKDOWN_FILE_EXTENSION', () => {
    expect(MARKDOWN_FILE_EXTENSION).toBe('md');
  });

  it('should export the correct CANVAS_FILE_EXTENSION', () => {
    expect(CANVAS_FILE_EXTENSION).toBe('canvas');
  });

  it('should export the correct BASE_FILE_EXTENSION', () => {
    expect(BASE_FILE_EXTENSION).toBe('base');
  });
});

describe('isFile', () => {
  it('should return true for a TFile instance', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(isFile(file)).toBe(true);
  });

  it('should return false for a TFolder instance', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(isFile(folder)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isFile(null)).toBe(false);
  });

  it('should return false for a plain object', () => {
    expect(isFile({ path: 'note.md' })).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isFile('note.md')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isFile(undefined)).toBe(false);
  });
});

describe('isFolder', () => {
  it('should return true for a TFolder instance', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(isFolder(folder)).toBe(true);
  });

  it('should return false for a TFile instance', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(isFolder(file)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isFolder(null)).toBe(false);
  });

  it('should return false for a plain object', () => {
    expect(isFolder({ path: 'folder' })).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isFolder('folder')).toBe(false);
  });
});

describe('isAbstractFile', () => {
  it('should return true for a TFile instance', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(isAbstractFile(file)).toBe(true);
  });

  it('should return true for a TFolder instance', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(isAbstractFile(folder)).toBe(true);
  });

  it('should return true for a TAbstractFile instance', () => {
    const abstract = createTFileInstance(app, 'something');
    expect(isAbstractFile(abstract)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isAbstractFile(null)).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isAbstractFile('note.md')).toBe(false);
  });
});

describe('asFile', () => {
  it('should return the file if the abstract file is a TFile', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(asFile(file)).toBe(file);
  });

  it('should throw if the abstract file is a TFolder', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(() => asFile(folder)).toThrow('Abstract file is not a file');
  });

  it('should throw if the abstract file is null', () => {
    expect(() => asFile(null)).toThrow('Abstract file is not a file');
  });
});

describe('asFileOrNull', () => {
  it('should return the file if the abstract file is a TFile', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(asFileOrNull(file)).toBe(file);
  });

  it('should return null if the abstract file is null', () => {
    expect(asFileOrNull(null)).toBeNull();
  });

  it('should throw if the abstract file is a TFolder', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(() => asFileOrNull(folder)).toThrow('Abstract file is not a file');
  });
});

describe('asFolder', () => {
  it('should return the folder if the abstract file is a TFolder', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(asFolder(folder)).toBe(folder);
  });

  it('should throw if the abstract file is a TFile', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(() => asFolder(file)).toThrow('Abstract file is not a folder');
  });

  it('should throw if the abstract file is null', () => {
    expect(() => asFolder(null)).toThrow('Abstract file is not a folder');
  });
});

describe('asFolderOrNull', () => {
  it('should return the folder if the abstract file is a TFolder', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(asFolderOrNull(folder)).toBe(folder);
  });

  it('should return null if the abstract file is null', () => {
    expect(asFolderOrNull(null)).toBeNull();
  });

  it('should throw if the abstract file is a TFile', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(() => asFolderOrNull(file)).toThrow('Abstract file is not a folder');
  });
});

describe('asArrayOfFiles', () => {
  it('should convert an array of TFile instances', () => {
    const files = [createTFileInstance(app, 'a.md'), createTFileInstance(app, 'b.md')];
    const result = asArrayOfFiles(files);
    expect(result).toEqual(files);
  });

  it('should throw if any element is a TFolder', () => {
    const items: TAbstractFile[] = [createTFileInstance(app, 'a.md'), createTFolderInstance(app, 'folder')];
    expect(() => asArrayOfFiles(items)).toThrow('Abstract file is not a file');
  });

  it('should handle an empty array', () => {
    expect(asArrayOfFiles([])).toEqual([]);
  });
});

describe('asArrayOfFolders', () => {
  it('should convert an array of TFolder instances', () => {
    const folders = [createTFolderInstance(app, 'a'), createTFolderInstance(app, 'b')];
    const result = asArrayOfFolders(folders);
    expect(result).toEqual(folders);
  });

  it('should throw if any element is a TFile', () => {
    const items: TAbstractFile[] = [createTFolderInstance(app, 'folder'), createTFileInstance(app, 'a.md')];
    expect(() => asArrayOfFolders(items)).toThrow('Abstract file is not a folder');
  });

  it('should handle an empty array', () => {
    expect(asArrayOfFolders([])).toEqual([]);
  });
});

describe('getFileSystemType', () => {
  it('should return File for a TFile', () => {
    const file = createTFileInstance(app, 'note.md');
    expect(getFileSystemType(file)).toBe(FileSystemType.File);
  });

  it('should return Folder for a TFolder', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(getFileSystemType(folder)).toBe(FileSystemType.Folder);
  });

  it('should throw for a plain TAbstractFile', () => {
    expect(() => getFileSystemType(castTo<TAbstractFile>({}))).toThrow('Abstract file is not a file or a folder');
  });
});

describe('checkExtension', () => {
  it('should return true when a TFile has the expected extension', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    expect(checkExtension(app, file, 'md')).toBe(true);
  });

  it('should return false when a TFile has a different extension', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getFileByPath('note.md');
    expect(checkExtension(app, file, 'canvas')).toBe(false);
  });

  it('should check extension by path string when the file exists in the vault', () => {
    app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    expect(checkExtension(app, 'drawing.canvas', 'canvas')).toBe(true);
  });

  it('should check extension by path string when the file does not exist in the vault', () => {
    expect(checkExtension(app, 'notes/test.md', 'md')).toBe(true);
  });

  it('should return false for null', () => {
    expect(checkExtension(app, null, 'md')).toBe(false);
  });

  it('should return false for a TFolder', () => {
    app = createMockApp({ folders: ['my-folder'] });
    const folder = app.vault.getFolderByPath('my-folder');
    expect(checkExtension(app, folder, 'md')).toBe(false);
  });
});

describe('isMarkdownFile', () => {
  it('should return true for a markdown file', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getFileByPath('note.md');
    expect(isMarkdownFile(app, file)).toBe(true);
  });

  it('should return false for a canvas file', () => {
    app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    const file = app.vault.getFileByPath('drawing.canvas');
    expect(isMarkdownFile(app, file)).toBe(false);
  });

  it('should return true for a path string ending with .md', () => {
    expect(isMarkdownFile(app, 'note.md')).toBe(true);
  });

  it('should return false for null', () => {
    expect(isMarkdownFile(app, null)).toBe(false);
  });
});

describe('isCanvasFile', () => {
  it('should return true for a canvas file', () => {
    app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    const file = app.vault.getFileByPath('drawing.canvas');
    expect(isCanvasFile(app, file)).toBe(true);
  });

  it('should return false for a markdown file', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getFileByPath('note.md');
    expect(isCanvasFile(app, file)).toBe(false);
  });

  it('should return true for a path string ending with .canvas', () => {
    expect(isCanvasFile(app, 'drawing.canvas')).toBe(true);
  });
});

describe('isBaseFile', () => {
  it('should return true for a base file', () => {
    app = createMockApp({ files: [{ extension: 'base', path: 'config.base' }] });
    const file = app.vault.getFileByPath('config.base');
    expect(isBaseFile(app, file)).toBe(true);
  });

  it('should return false for a markdown file', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getFileByPath('note.md');
    expect(isBaseFile(app, file)).toBe(false);
  });
});

describe('isNote', () => {
  it('should return true for a markdown file', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getFileByPath('note.md');
    expect(isNote(app, file)).toBe(true);
  });

  it('should return true for a canvas file', () => {
    app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    const file = app.vault.getFileByPath('drawing.canvas');
    expect(isNote(app, file)).toBe(true);
  });

  it('should return true for a base file', () => {
    app = createMockApp({ files: [{ extension: 'base', path: 'config.base' }] });
    const file = app.vault.getFileByPath('config.base');
    expect(isNote(app, file)).toBe(true);
  });

  it('should return false for an image file', () => {
    app = createMockApp({ files: [{ extension: 'png', path: 'image.png' }] });
    const file = app.vault.getFileByPath('image.png');
    expect(isNote(app, file)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isNote(app, null)).toBe(false);
  });
});

describe('getAbstractFileOrNull', () => {
  describe('should return the file when found by path', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getAbstractFileOrNull(app, 'note.md');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNonNullable(result);
      expect(result.path).toBe('note.md');
    });
  });

  it('should return null when not found', () => {
    const result = getAbstractFileOrNull(app, 'nonexistent.md');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    expect(getAbstractFileOrNull(app, null)).toBeNull();
  });

  it('should return a TAbstractFile when passed directly', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = createTFileInstance(app, 'note.md');
    const result = getAbstractFileOrNull(app, file);
    expect(result).not.toBeNull();
  });

  it('should return the TAbstractFile itself when not in fileMap', () => {
    const file = createTFileInstance(app, 'orphan.md');
    const result = getAbstractFileOrNull(app, file);
    expect(result).toBe(file);
  });
});

describe('getAbstractFile', () => {
  it('should return the file when found', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getAbstractFile(app, 'note.md');
    expect(result.path).toBe('note.md');
  });

  it('should throw when not found', () => {
    expect(() => getAbstractFile(app, 'nonexistent.md')).toThrow('Abstract file not found');
  });
});

describe('getFileOrNull', () => {
  describe('should return the file when found', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getFileOrNull(app, 'note.md');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNonNullable(result);
      expect(result.path).toBe('note.md');
    });
  });

  it('should return null when path refers to a folder', () => {
    app = createMockApp({ folders: ['my-folder'] });
    const result = getFileOrNull(app, 'my-folder');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    expect(getFileOrNull(app, null)).toBeNull();
  });
});

describe('getFile', () => {
  it('should return the file when found', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getFile(app, 'note.md');
    expect(result.path).toBe('note.md');
  });

  it('should throw when not found and shouldIncludeNonExisting is false', () => {
    expect(() => getFile(app, 'nonexistent.md')).toThrow('File not found');
  });

  describe('should create a new TFile when not found and shouldIncludeNonExisting is true', () => {
    const result = getFile(app, 'new-note.md', true);

    it('should be a TFile instance', () => {
      expect(result).toBeInstanceOf(TFile);
    });

    it('should have the correct path', () => {
      expect(result.path).toBe('new-note.md');
    });
  });
});

describe('getFolderOrNull', () => {
  describe('should return the folder when found', () => {
    app = createMockApp({ folders: ['my-folder'] });
    const result = getFolderOrNull(app, 'my-folder');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNonNullable(result);
      expect(result.path).toBe('my-folder');
    });
  });

  it('should return null when path refers to a file', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getFolderOrNull(app, 'note.md');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    expect(getFolderOrNull(app, null)).toBeNull();
  });
});

describe('getFolder', () => {
  it('should return the folder when found', () => {
    app = createMockApp({ folders: ['my-folder'] });
    const result = getFolder(app, 'my-folder');
    expect(result.path).toBe('my-folder');
  });

  it('should throw when not found and shouldIncludeNonExisting is false', () => {
    expect(() => getFolder(app, 'nonexistent')).toThrow('Folder not found');
  });

  describe('should create a new TFolder when not found and shouldIncludeNonExisting is true', () => {
    const result = getFolder(app, 'new-folder', true);

    it('should be a TFolder instance', () => {
      expect(result).toBeInstanceOf(TFolder);
    });

    it('should have the correct path', () => {
      expect(result.path).toBe('new-folder');
    });
  });
});

describe('getPath', () => {
  it('should return the path string when given a string', () => {
    expect(getPath(app, 'note.md')).toBe('note.md');
  });

  it('should return the path from a TFile', () => {
    const file = createTFileInstance(app, 'folder/note.md');
    expect(getPath(app, file)).toBe('folder/note.md');
  });

  it('should return the path from a TFolder', () => {
    const folder = createTFolderInstance(app, 'my-folder');
    expect(getPath(app, folder)).toBe('my-folder');
  });

  it('should return the resolved path from the vault if file exists', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getPath(app, 'note.md');
    expect(result).toBe('note.md');
  });
});

describe('exists', () => {
  it('should return true when the file exists', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    expect(exists(app, 'note.md')).toBe(true);
  });

  it('should return false when the file does not exist', () => {
    expect(exists(app, 'nonexistent.md')).toBe(false);
  });

  it('should return true when checking for a file with File type', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    expect(exists(app, 'note.md', FileSystemType.File)).toBe(true);
  });

  it('should return false when checking for a file with Folder type', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    expect(exists(app, 'note.md', FileSystemType.Folder)).toBe(false);
  });

  it('should return true when checking for a folder with Folder type', () => {
    app = createMockApp({ folders: ['my-folder'] });
    expect(exists(app, 'my-folder', FileSystemType.Folder)).toBe(true);
  });

  it('should return false when checking for a folder with File type', () => {
    app = createMockApp({ folders: ['my-folder'] });
    expect(exists(app, 'my-folder', FileSystemType.File)).toBe(false);
  });
});

describe('trimMarkdownExtension', () => {
  it('should trim the .md extension from a markdown file', () => {
    app = createMockApp({ files: [{ path: 'folder/note.md' }] });
    const file = app.vault.getFileByPath('folder/note.md');
    assertNonNullable(file);
    expect(trimMarkdownExtension(app, file)).toBe('folder/note');
  });

  it('should not trim the extension from a non-markdown file', () => {
    app = createMockApp({ files: [{ extension: 'canvas', path: 'drawing.canvas' }] });
    const file = app.vault.getFileByPath('drawing.canvas');
    assertNonNullable(file);
    expect(trimMarkdownExtension(app, file)).toBe('drawing.canvas');
  });

  it('should not trim from a folder', () => {
    app = createMockApp({ folders: ['my-folder'] });
    const folder = app.vault.getFolderByPath('my-folder');
    assertNonNullable(folder);
    expect(trimMarkdownExtension(app, folder)).toBe('my-folder');
  });
});

describe('getAbstractFileOrNull (resolved path fallback)', () => {
  it('should resolve a relative path and find the file', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getAbstractFileOrNull(app, './note.md');
    assertNonNullable(result);
    expect(result.path).toBe('note.md');
  });

  it('should resolve a path with parent traversal', () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getAbstractFileOrNull(app, 'folder/../note.md');
    assertNonNullable(result);
    expect(result.path).toBe('note.md');
  });
});

describe('getAbstractFileOrNull (case-insensitive)', () => {
  it('should find a file case-insensitively when isCaseInsensitive is true', () => {
    app = createMockApp({ files: [{ path: 'Note.md' }] });
    const result = getAbstractFileOrNull(app, 'note.md', true);
    assertNonNullable(result);
    expect(result.path).toBe('Note.md');
  });

  it('should use adapter.insensitive when isCaseInsensitive is not provided', () => {
    app = createMockApp({ files: [{ path: 'Note.md' }] });
    (app.vault.adapter as { insensitive: boolean }).insensitive = true;
    const result = getAbstractFileOrNull(app, 'note.md');
    assertNonNullable(result);
    expect(result.path).toBe('Note.md');
  });
});

describe('getMarkdownFiles', () => {
  it('should return markdown files in a folder (non-recursive)', () => {
    app = createMockApp({
      files: [
        { path: 'docs/a.md' },
        { path: 'docs/b.md' },
        { extension: 'png', path: 'docs/image.png' }
      ],
      folders: ['docs']
    });
    const folder = app.vault.getFolderByPath('docs');
    assertNonNullable(folder);
    const fileA = app.vault.getFileByPath('docs/a.md');
    assertNonNullable(fileA);
    const fileB = app.vault.getFileByPath('docs/b.md');
    assertNonNullable(fileB);
    const filePng = app.vault.getFileByPath('docs/image.png');
    assertNonNullable(filePng);
    folder.children = [fileA, fileB, filePng];

    const result = getMarkdownFiles(app, folder);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.path)).toEqual(['docs/a.md', 'docs/b.md']);
  });

  it('should return markdown files recursively', () => {
    app = createMockApp({
      files: [
        { path: 'docs/a.md' },
        { path: 'docs/sub/b.md' }
      ],
      folders: ['docs', 'docs/sub']
    });
    const folder = app.vault.getFolderByPath('docs');
    assertNonNullable(folder);
    const subFolder = app.vault.getFolderByPath('docs/sub');
    assertNonNullable(subFolder);
    const fileA = app.vault.getFileByPath('docs/a.md');
    assertNonNullable(fileA);
    const fileB = app.vault.getFileByPath('docs/sub/b.md');
    assertNonNullable(fileB);
    folder.children = [fileA, subFolder];
    subFolder.children = [fileB];

    const result = getMarkdownFiles(app, folder, true);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.path)).toEqual(['docs/a.md', 'docs/sub/b.md']);
  });

  it('should return an empty array when no markdown files exist', () => {
    app = createMockApp({
      files: [{ extension: 'png', path: 'docs/image.png' }],
      folders: ['docs']
    });
    const folder = app.vault.getFolderByPath('docs');
    assertNonNullable(folder);
    const filePng = app.vault.getFileByPath('docs/image.png');
    assertNonNullable(filePng);
    folder.children = [filePng];

    const result = getMarkdownFiles(app, folder);
    expect(result).toHaveLength(0);
  });
});

describe('getOrCreateFile', () => {
  it('should return the existing file if it exists', async () => {
    app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = await getOrCreateFile(app, 'note.md');
    expect(result.path).toBe('note.md');
  });

  it('should create a new file if it does not exist', async () => {
    const result = await getOrCreateFile(app, 'new-note.md');
    expect(result).toBeInstanceOf(TFile);
    expect(result.path).toBe('new-note.md');
  });
});

describe('getOrCreateFolder', () => {
  it('should return the existing folder if it exists', async () => {
    app = createMockApp({ folders: ['my-folder'] });
    const result = await getOrCreateFolder(app, 'my-folder');
    expect(result.path).toBe('my-folder');
  });

  it('should create a new folder if it does not exist', async () => {
    const result = await getOrCreateFolder(app, 'new-folder');
    expect(result).toBeInstanceOf(TFolder);
    expect(result.path).toBe('new-folder');
  });
});
