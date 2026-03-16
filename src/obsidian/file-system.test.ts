// @vitest-environment jsdom
import type {
  App as AppOriginal,
  TAbstractFile
} from 'obsidian';

import {
  App,
  TFile,
  TFolder
} from 'obsidian-test-mocks/obsidian';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { assertNonNullable } from '../type-guards.ts';
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
} from './file-system.ts';

let app: AppOriginal;

beforeEach(async () => {
  app = App.createConfigured__().asOriginalType__();
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
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    expect(isFile(file)).toBe(true);
  });

  it('should return false for a TFolder instance', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
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
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(isFolder(folder)).toBe(true);
  });

  it('should return false for a TFile instance', () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
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
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    expect(isAbstractFile(file)).toBe(true);
  });

  it('should return true for a TFolder instance', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(isAbstractFile(folder)).toBe(true);
  });

  it('should return true for a TAbstractFile instance', () => {
    const abstract = TFile.create__(castTo(app.vault), 'something').asOriginalType2__();
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
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    expect(asFile(file)).toBe(file);
  });

  it('should throw if the abstract file is a TFolder', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(() => asFile(folder)).toThrow('Abstract file is not a file');
  });

  it('should throw if the abstract file is null', () => {
    expect(() => asFile(null)).toThrow('Abstract file is not a file');
  });
});

describe('asFileOrNull', () => {
  it('should return the file if the abstract file is a TFile', () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    expect(asFileOrNull(file)).toBe(file);
  });

  it('should return null if the abstract file is null', () => {
    expect(asFileOrNull(null)).toBeNull();
  });

  it('should throw if the abstract file is a TFolder', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(() => asFileOrNull(folder)).toThrow('Abstract file is not a file');
  });
});

describe('asFolder', () => {
  it('should return the folder if the abstract file is a TFolder', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(asFolder(folder)).toBe(folder);
  });

  it('should throw if the abstract file is a TFile', () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    expect(() => asFolder(file)).toThrow('Abstract file is not a folder');
  });

  it('should throw if the abstract file is null', () => {
    expect(() => asFolder(null)).toThrow('Abstract file is not a folder');
  });
});

describe('asFolderOrNull', () => {
  it('should return the folder if the abstract file is a TFolder', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(asFolderOrNull(folder)).toBe(folder);
  });

  it('should return null if the abstract file is null', () => {
    expect(asFolderOrNull(null)).toBeNull();
  });

  it('should throw if the abstract file is a TFile', () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    expect(() => asFolderOrNull(file)).toThrow('Abstract file is not a folder');
  });
});

describe('asArrayOfFiles', () => {
  it('should convert an array of TFile instances', () => {
    const files = [TFile.create__(castTo(app.vault), 'a.md').asOriginalType2__(), TFile.create__(castTo(app.vault), 'b.md').asOriginalType2__()];
    const result = asArrayOfFiles(files);
    expect(result).toEqual(files);
  });

  it('should throw if any element is a TFolder', () => {
    const items: TAbstractFile[] = [
      TFile.create__(castTo(app.vault), 'a.md').asOriginalType2__(),
      TFolder.create__(castTo(app.vault), 'folder').asOriginalType2__()
    ];
    expect(() => asArrayOfFiles(items)).toThrow('Abstract file is not a file');
  });

  it('should handle an empty array', () => {
    expect(asArrayOfFiles([])).toEqual([]);
  });
});

describe('asArrayOfFolders', () => {
  it('should convert an array of TFolder instances', () => {
    const folders = [TFolder.create__(castTo(app.vault), 'a').asOriginalType2__(), TFolder.create__(castTo(app.vault), 'b').asOriginalType2__()];
    const result = asArrayOfFolders(folders);
    expect(result).toEqual(folders);
  });

  it('should throw if any element is a TFile', () => {
    const items: TAbstractFile[] = [
      TFolder.create__(castTo(app.vault), 'folder').asOriginalType2__(),
      TFile.create__(castTo(app.vault), 'a.md').asOriginalType2__()
    ];
    expect(() => asArrayOfFolders(items)).toThrow('Abstract file is not a folder');
  });

  it('should handle an empty array', () => {
    expect(asArrayOfFolders([])).toEqual([]);
  });
});

describe('getFileSystemType', () => {
  it('should return File for a TFile', () => {
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    expect(getFileSystemType(file)).toBe(FileSystemType.File);
  });

  it('should return Folder for a TFolder', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(getFileSystemType(folder)).toBe(FileSystemType.Folder);
  });

  it('should throw for a plain TAbstractFile', () => {
    expect(() => getFileSystemType(castTo<TAbstractFile>({}))).toThrow('Abstract file is not a file or a folder');
  });
});

describe('checkExtension', () => {
  it('should return true when a TFile has the expected extension', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    expect(checkExtension(app, file, 'md')).toBe(true);
  });

  it('should return false when a TFile has a different extension', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('note.md');
    expect(checkExtension(app, file, 'canvas')).toBe(false);
  });

  it('should check extension by path string when the file exists in the vault', () => {
    app = App.createConfigured__({ files: { 'drawing.canvas': '' } }).asOriginalType__();
    expect(checkExtension(app, 'drawing.canvas', 'canvas')).toBe(true);
  });

  it('should check extension by path string when the file does not exist in the vault', () => {
    expect(checkExtension(app, 'notes/test.md', 'md')).toBe(true);
  });

  it('should return false for null', () => {
    expect(checkExtension(app, null, 'md')).toBe(false);
  });

  it('should return false for a TFolder', () => {
    app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
    const folder = app.vault.getFolderByPath('my-folder');
    expect(checkExtension(app, folder, 'md')).toBe(false);
  });
});

describe('isMarkdownFile', () => {
  it('should return true for a markdown file', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('note.md');
    expect(isMarkdownFile(app, file)).toBe(true);
  });

  it('should return false for a canvas file', () => {
    app = App.createConfigured__({ files: { 'drawing.canvas': '' } }).asOriginalType__();
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
    app = App.createConfigured__({ files: { 'drawing.canvas': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('drawing.canvas');
    expect(isCanvasFile(app, file)).toBe(true);
  });

  it('should return false for a markdown file', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('note.md');
    expect(isCanvasFile(app, file)).toBe(false);
  });

  it('should return true for a path string ending with .canvas', () => {
    expect(isCanvasFile(app, 'drawing.canvas')).toBe(true);
  });
});

describe('isBaseFile', () => {
  it('should return true for a base file', () => {
    app = App.createConfigured__({ files: { 'config.base': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('config.base');
    expect(isBaseFile(app, file)).toBe(true);
  });

  it('should return false for a markdown file', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('note.md');
    expect(isBaseFile(app, file)).toBe(false);
  });
});

describe('isNote', () => {
  it('should return true for a markdown file', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('note.md');
    expect(isNote(app, file)).toBe(true);
  });

  it('should return true for a canvas file', () => {
    app = App.createConfigured__({ files: { 'drawing.canvas': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('drawing.canvas');
    expect(isNote(app, file)).toBe(true);
  });

  it('should return true for a base file', () => {
    app = App.createConfigured__({ files: { 'config.base': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('config.base');
    expect(isNote(app, file)).toBe(true);
  });

  it('should return false for an image file', () => {
    app = App.createConfigured__({ files: { 'image.png': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('image.png');
    expect(isNote(app, file)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isNote(app, null)).toBe(false);
  });
});

describe('getAbstractFileOrNull', () => {
  describe('should return the file when found by path', () => {
    let result: ReturnType<typeof getAbstractFileOrNull>;
    beforeAll(async () => {
      app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
      result = getAbstractFileOrNull(app, 'note.md');
    });

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
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const file = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
    const result = getAbstractFileOrNull(app, file);
    expect(result).not.toBeNull();
  });

  it('should return the TAbstractFile itself when not in fileMap', () => {
    const file = TFile.create__(castTo(app.vault), 'orphan.md').asOriginalType2__();
    const result = getAbstractFileOrNull(app, file);
    expect(result).toBe(file);
  });
});

describe('getAbstractFile', () => {
  it('should return the file when found', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const result = getAbstractFile(app, 'note.md');
    expect(result.path).toBe('note.md');
  });

  it('should throw when not found', () => {
    expect(() => getAbstractFile(app, 'nonexistent.md')).toThrow('Abstract file not found');
  });
});

describe('getFileOrNull', () => {
  describe('should return the file when found', () => {
    let result: ReturnType<typeof getFileOrNull>;
    beforeAll(async () => {
      app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
      result = getFileOrNull(app, 'note.md');
    });

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNonNullable(result);
      expect(result.path).toBe('note.md');
    });
  });

  it('should return null when path refers to a folder', () => {
    app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
    const result = getFileOrNull(app, 'my-folder');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    expect(getFileOrNull(app, null)).toBeNull();
  });
});

describe('getFile', () => {
  it('should return the file when found', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const result = getFile(app, 'note.md');
    expect(result.path).toBe('note.md');
  });

  it('should throw when not found and shouldIncludeNonExisting is false', () => {
    expect(() => getFile(app, 'nonexistent.md')).toThrow('File not found');
  });

  describe('should create a new TFile when not found and shouldIncludeNonExisting is true', () => {
    let result: ReturnType<typeof getFile>;
    beforeAll(() => {
      result = getFile(app, 'new-note.md', true);
    });

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
    let result: ReturnType<typeof getFolderOrNull>;
    beforeAll(async () => {
      app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
      result = getFolderOrNull(app, 'my-folder');
    });

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNonNullable(result);
      expect(result.path).toBe('my-folder');
    });
  });

  it('should return null when path refers to a file', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const result = getFolderOrNull(app, 'note.md');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    expect(getFolderOrNull(app, null)).toBeNull();
  });
});

describe('getFolder', () => {
  it('should return the folder when found', () => {
    app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
    const result = getFolder(app, 'my-folder');
    expect(result.path).toBe('my-folder');
  });

  it('should throw when not found and shouldIncludeNonExisting is false', () => {
    expect(() => getFolder(app, 'nonexistent')).toThrow('Folder not found');
  });

  describe('should create a new TFolder when not found and shouldIncludeNonExisting is true', () => {
    let result: ReturnType<typeof getFolder>;
    beforeAll(() => {
      result = getFolder(app, 'new-folder', true);
    });

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
    const file = TFile.create__(castTo(app.vault), 'folder/note.md').asOriginalType2__();
    expect(getPath(app, file)).toBe('folder/note.md');
  });

  it('should return the path from a TFolder', () => {
    const folder = TFolder.create__(castTo(app.vault), 'my-folder').asOriginalType2__();
    expect(getPath(app, folder)).toBe('my-folder');
  });

  it('should return the resolved path from the vault if file exists', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const result = getPath(app, 'note.md');
    expect(result).toBe('note.md');
  });
});

describe('exists', () => {
  it('should return true when the file exists', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    expect(exists(app, 'note.md')).toBe(true);
  });

  it('should return false when the file does not exist', () => {
    expect(exists(app, 'nonexistent.md')).toBe(false);
  });

  it('should return true when checking for a file with File type', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    expect(exists(app, 'note.md', FileSystemType.File)).toBe(true);
  });

  it('should return false when checking for a file with Folder type', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    expect(exists(app, 'note.md', FileSystemType.Folder)).toBe(false);
  });

  it('should return true when checking for a folder with Folder type', () => {
    app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
    expect(exists(app, 'my-folder', FileSystemType.Folder)).toBe(true);
  });

  it('should return false when checking for a folder with File type', () => {
    app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
    expect(exists(app, 'my-folder', FileSystemType.File)).toBe(false);
  });
});

describe('trimMarkdownExtension', () => {
  it('should trim the .md extension from a markdown file', () => {
    app = App.createConfigured__({ files: { 'folder/note.md': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('folder/note.md');
    assertNonNullable(file);
    expect(trimMarkdownExtension(app, file)).toBe('folder/note');
  });

  it('should not trim the extension from a non-markdown file', () => {
    app = App.createConfigured__({ files: { 'drawing.canvas': '' } }).asOriginalType__();
    const file = app.vault.getFileByPath('drawing.canvas');
    assertNonNullable(file);
    expect(trimMarkdownExtension(app, file)).toBe('drawing.canvas');
  });

  it('should not trim from a folder', () => {
    app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
    const folder = app.vault.getFolderByPath('my-folder');
    assertNonNullable(folder);
    expect(trimMarkdownExtension(app, folder)).toBe('my-folder');
  });
});

describe('getAbstractFileOrNull (resolved path fallback)', () => {
  it('should resolve a relative path and find the file', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const result = getAbstractFileOrNull(app, './note.md');
    assertNonNullable(result);
    expect(result.path).toBe('note.md');
  });

  it('should resolve a path with parent traversal', () => {
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
    const result = getAbstractFileOrNull(app, 'folder/../note.md');
    assertNonNullable(result);
    expect(result.path).toBe('note.md');
  });
});

describe('getAbstractFileOrNull (case-insensitive)', () => {
  it('should find a file case-insensitively when isCaseInsensitive is true', () => {
    app = App.createConfigured__({ files: { 'Note.md': '' } }).asOriginalType__();
    const result = getAbstractFileOrNull(app, 'note.md', true);
    assertNonNullable(result);
    expect(result.path).toBe('Note.md');
  });

  it('should use adapter.insensitive when isCaseInsensitive is not provided', () => {
    app = App.createConfigured__({ files: { 'Note.md': '' }, isAdapterCaseInsensitive: true }).asOriginalType__();
    const result = getAbstractFileOrNull(app, 'note.md');
    assertNonNullable(result);
    expect(result.path).toBe('Note.md');
  });
});

describe('getMarkdownFiles', () => {
  it('should return markdown files in a folder (non-recursive)', () => {
    app = (
      App.createConfigured__({
        files: {
          'docs/a.md': '',
          'docs/b.md': '',
          'docs/image.png': ''
        }
      })
    ).asOriginalType__();
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
    app = (
      App.createConfigured__({
        files: {
          'docs/a.md': '',
          'docs/sub/b.md': ''
        }
      })
    ).asOriginalType__();
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
    app = (
      App.createConfigured__({
        files: {
          'docs/image.png': ''
        }
      })
    ).asOriginalType__();
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
    app = App.createConfigured__({ files: { 'note.md': '' } }).asOriginalType__();
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
    app = App.createConfigured__({ files: { 'my-folder/': '' } }).asOriginalType__();
    const result = await getOrCreateFolder(app, 'my-folder');
    expect(result.path).toBe('my-folder');
  });

  it('should create a new folder if it does not exist', async () => {
    const result = await getOrCreateFolder(app, 'new-folder');
    expect(result).toBeInstanceOf(TFolder);
    expect(result.path).toBe('new-folder');
  });
});
