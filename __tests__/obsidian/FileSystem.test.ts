import {
  TAbstractFile,
  TFile,
  TFolder
} from 'obsidian';
// @vitest-environment jsdom
import {
  describe,
  expect,
  it
} from 'vitest';

import { assertNotNullable } from '../__helpers.ts';
import { createMockApp } from '../../__mocks__/obsidian/App.ts';
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
} from '../../src/obsidian/FileSystem.ts';

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
    const file = createTestFile('note.md');
    expect(isFile(file)).toBe(true);
  });

  it('should return false for a TFolder instance', () => {
    const folder = createTestFolder('my-folder');
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
    const folder = createTestFolder('my-folder');
    expect(isFolder(folder)).toBe(true);
  });

  it('should return false for a TFile instance', () => {
    const file = createTestFile('note.md');
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
    const file = createTestFile('note.md');
    expect(isAbstractFile(file)).toBe(true);
  });

  it('should return true for a TFolder instance', () => {
    const folder = createTestFolder('my-folder');
    expect(isAbstractFile(folder)).toBe(true);
  });

  it('should return true for a TAbstractFile instance', () => {
    const abstract = new (TAbstractFile as unknown as new () => TAbstractFile)();
    abstract.path = 'something';
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
    const file = createTestFile('note.md');
    expect(asFile(file)).toBe(file);
  });

  it('should throw if the abstract file is a TFolder', () => {
    const folder = createTestFolder('my-folder');
    expect(() => asFile(folder)).toThrow('Abstract file is not a file');
  });

  it('should throw if the abstract file is null', () => {
    expect(() => asFile(null)).toThrow('Abstract file is not a file');
  });
});

describe('asFileOrNull', () => {
  it('should return the file if the abstract file is a TFile', () => {
    const file = createTestFile('note.md');
    expect(asFileOrNull(file)).toBe(file);
  });

  it('should return null if the abstract file is null', () => {
    expect(asFileOrNull(null)).toBeNull();
  });

  it('should throw if the abstract file is a TFolder', () => {
    const folder = createTestFolder('my-folder');
    expect(() => asFileOrNull(folder)).toThrow('Abstract file is not a file');
  });
});

describe('asFolder', () => {
  it('should return the folder if the abstract file is a TFolder', () => {
    const folder = createTestFolder('my-folder');
    expect(asFolder(folder)).toBe(folder);
  });

  it('should throw if the abstract file is a TFile', () => {
    const file = createTestFile('note.md');
    expect(() => asFolder(file)).toThrow('Abstract file is not a folder');
  });

  it('should throw if the abstract file is null', () => {
    expect(() => asFolder(null)).toThrow('Abstract file is not a folder');
  });
});

describe('asFolderOrNull', () => {
  it('should return the folder if the abstract file is a TFolder', () => {
    const folder = createTestFolder('my-folder');
    expect(asFolderOrNull(folder)).toBe(folder);
  });

  it('should return null if the abstract file is null', () => {
    expect(asFolderOrNull(null)).toBeNull();
  });

  it('should throw if the abstract file is a TFile', () => {
    const file = createTestFile('note.md');
    expect(() => asFolderOrNull(file)).toThrow('Abstract file is not a folder');
  });
});

describe('asArrayOfFiles', () => {
  it('should convert an array of TFile instances', () => {
    const files = [createTestFile('a.md'), createTestFile('b.md')];
    const result = asArrayOfFiles(files);
    expect(result).toEqual(files);
  });

  it('should throw if any element is a TFolder', () => {
    const items: TAbstractFile[] = [createTestFile('a.md'), createTestFolder('folder')];
    expect(() => asArrayOfFiles(items)).toThrow('Abstract file is not a file');
  });

  it('should handle an empty array', () => {
    expect(asArrayOfFiles([])).toEqual([]);
  });
});

describe('asArrayOfFolders', () => {
  it('should convert an array of TFolder instances', () => {
    const folders = [createTestFolder('a'), createTestFolder('b')];
    const result = asArrayOfFolders(folders);
    expect(result).toEqual(folders);
  });

  it('should throw if any element is a TFile', () => {
    const items: TAbstractFile[] = [createTestFolder('folder'), createTestFile('a.md')];
    expect(() => asArrayOfFolders(items)).toThrow('Abstract file is not a folder');
  });

  it('should handle an empty array', () => {
    expect(asArrayOfFolders([])).toEqual([]);
  });
});

describe('getFileSystemType', () => {
  it('should return File for a TFile', () => {
    const file = createTestFile('note.md');
    expect(getFileSystemType(file)).toBe(FileSystemType.File);
  });

  it('should return Folder for a TFolder', () => {
    const folder = createTestFolder('my-folder');
    expect(getFileSystemType(folder)).toBe(FileSystemType.Folder);
  });

  it('should throw for a plain TAbstractFile', () => {
    const abstract = new (TAbstractFile as unknown as new () => TAbstractFile)();
    expect(() => getFileSystemType(abstract)).toThrow('Abstract file is not a file or a folder');
  });
});

describe('checkExtension', () => {
  it('should return true when a TFile has the expected extension', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getAbstractFileByPath('note.md') as TFile;
    expect(checkExtension(app, file, 'md')).toBe(true);
  });

  it('should return false when a TFile has a different extension', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getAbstractFileByPath('note.md') as TFile;
    expect(checkExtension(app, file, 'canvas')).toBe(false);
  });

  it('should check extension by path string when the file exists in the vault', () => {
    const app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    expect(checkExtension(app, 'drawing.canvas', 'canvas')).toBe(true);
  });

  it('should check extension by path string when the file does not exist in the vault', () => {
    const app = createMockApp();
    expect(checkExtension(app, 'notes/test.md', 'md')).toBe(true);
  });

  it('should return false for null', () => {
    const app = createMockApp();
    expect(checkExtension(app, null, 'md')).toBe(false);
  });

  it('should return false for a TFolder', () => {
    const app = createMockApp({ folders: ['my-folder'] });
    const folder = app.vault.getAbstractFileByPath('my-folder');
    expect(checkExtension(app, folder, 'md')).toBe(false);
  });
});

describe('isMarkdownFile', () => {
  it('should return true for a markdown file', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getAbstractFileByPath('note.md') as TFile;
    expect(isMarkdownFile(app, file)).toBe(true);
  });

  it('should return false for a canvas file', () => {
    const app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    const file = app.vault.getAbstractFileByPath('drawing.canvas') as TFile;
    expect(isMarkdownFile(app, file)).toBe(false);
  });

  it('should return true for a path string ending with .md', () => {
    const app = createMockApp();
    expect(isMarkdownFile(app, 'note.md')).toBe(true);
  });

  it('should return false for null', () => {
    const app = createMockApp();
    expect(isMarkdownFile(app, null)).toBe(false);
  });
});

describe('isCanvasFile', () => {
  it('should return true for a canvas file', () => {
    const app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    const file = app.vault.getAbstractFileByPath('drawing.canvas') as TFile;
    expect(isCanvasFile(app, file)).toBe(true);
  });

  it('should return false for a markdown file', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getAbstractFileByPath('note.md') as TFile;
    expect(isCanvasFile(app, file)).toBe(false);
  });

  it('should return true for a path string ending with .canvas', () => {
    const app = createMockApp();
    expect(isCanvasFile(app, 'drawing.canvas')).toBe(true);
  });
});

describe('isBaseFile', () => {
  it('should return true for a base file', () => {
    const app = createMockApp({ files: [{ extension: 'base', path: 'config.base' }] });
    const file = app.vault.getAbstractFileByPath('config.base') as TFile;
    expect(isBaseFile(app, file)).toBe(true);
  });

  it('should return false for a markdown file', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getAbstractFileByPath('note.md') as TFile;
    expect(isBaseFile(app, file)).toBe(false);
  });
});

describe('isNote', () => {
  it('should return true for a markdown file', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const file = app.vault.getAbstractFileByPath('note.md') as TFile;
    expect(isNote(app, file)).toBe(true);
  });

  it('should return true for a canvas file', () => {
    const app = createMockApp({ files: [{ path: 'drawing.canvas' }] });
    const file = app.vault.getAbstractFileByPath('drawing.canvas') as TFile;
    expect(isNote(app, file)).toBe(true);
  });

  it('should return true for a base file', () => {
    const app = createMockApp({ files: [{ extension: 'base', path: 'config.base' }] });
    const file = app.vault.getAbstractFileByPath('config.base') as TFile;
    expect(isNote(app, file)).toBe(true);
  });

  it('should return false for an image file', () => {
    const app = createMockApp({ files: [{ extension: 'png', path: 'image.png' }] });
    const file = app.vault.getAbstractFileByPath('image.png') as TFile;
    expect(isNote(app, file)).toBe(false);
  });

  it('should return false for null', () => {
    const app = createMockApp();
    expect(isNote(app, null)).toBe(false);
  });
});

describe('getAbstractFileOrNull', () => {
  describe('should return the file when found by path', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getAbstractFileOrNull(app, 'note.md');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNotNullable(result);
      expect(result.path).toBe('note.md');
    });
  });

  it('should return null when not found', () => {
    const app = createMockApp();
    const result = getAbstractFileOrNull(app, 'nonexistent.md');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const app = createMockApp();
    expect(getAbstractFileOrNull(app, null)).toBeNull();
  });

  it('should return a TAbstractFile when passed directly', () => {
    const file = createTestFile('note.md');
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getAbstractFileOrNull(app, file);
    expect(result).not.toBeNull();
  });
});

describe('getAbstractFile', () => {
  it('should return the file when found', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getAbstractFile(app, 'note.md');
    expect(result.path).toBe('note.md');
  });

  it('should throw when not found', () => {
    const app = createMockApp();
    expect(() => getAbstractFile(app, 'nonexistent.md')).toThrow('Abstract file not found');
  });
});

describe('getFileOrNull', () => {
  describe('should return the file when found', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getFileOrNull(app, 'note.md');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNotNullable(result);
      expect(result.path).toBe('note.md');
    });
  });

  it('should return null when path refers to a folder', () => {
    const app = createMockApp({ folders: ['my-folder'] });
    const result = getFileOrNull(app, 'my-folder');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const app = createMockApp();
    expect(getFileOrNull(app, null)).toBeNull();
  });
});

describe('getFile', () => {
  it('should return the file when found', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getFile(app, 'note.md');
    expect(result.path).toBe('note.md');
  });

  it('should throw when not found and shouldIncludeNonExisting is false', () => {
    const app = createMockApp();
    expect(() => getFile(app, 'nonexistent.md')).toThrow('File not found');
  });

  describe('should create a new TFile when not found and shouldIncludeNonExisting is true', () => {
    const app = createMockApp();
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
    const app = createMockApp({ folders: ['my-folder'] });
    const result = getFolderOrNull(app, 'my-folder');

    it('should not be null', () => {
      expect(result).not.toBeNull();
    });

    it('should have the correct path', () => {
      assertNotNullable(result);
      expect(result.path).toBe('my-folder');
    });
  });

  it('should return null when path refers to a file', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getFolderOrNull(app, 'note.md');
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const app = createMockApp();
    expect(getFolderOrNull(app, null)).toBeNull();
  });
});

describe('getFolder', () => {
  it('should return the folder when found', () => {
    const app = createMockApp({ folders: ['my-folder'] });
    const result = getFolder(app, 'my-folder');
    expect(result.path).toBe('my-folder');
  });

  it('should throw when not found and shouldIncludeNonExisting is false', () => {
    const app = createMockApp();
    expect(() => getFolder(app, 'nonexistent')).toThrow('Folder not found');
  });

  describe('should create a new TFolder when not found and shouldIncludeNonExisting is true', () => {
    const app = createMockApp();
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
    const app = createMockApp();
    expect(getPath(app, 'note.md')).toBe('note.md');
  });

  it('should return the path from a TFile', () => {
    const file = createTestFile('folder/note.md');
    const app = createMockApp();
    expect(getPath(app, file)).toBe('folder/note.md');
  });

  it('should return the path from a TFolder', () => {
    const folder = createTestFolder('my-folder');
    const app = createMockApp();
    expect(getPath(app, folder)).toBe('my-folder');
  });

  it('should return the resolved path from the vault if file exists', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    const result = getPath(app, 'note.md');
    expect(result).toBe('note.md');
  });
});

describe('exists', () => {
  it('should return true when the file exists', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    expect(exists(app, 'note.md')).toBe(true);
  });

  it('should return false when the file does not exist', () => {
    const app = createMockApp();
    expect(exists(app, 'nonexistent.md')).toBe(false);
  });

  it('should return true when checking for a file with File type', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    expect(exists(app, 'note.md', FileSystemType.File)).toBe(true);
  });

  it('should return false when checking for a file with Folder type', () => {
    const app = createMockApp({ files: [{ path: 'note.md' }] });
    expect(exists(app, 'note.md', FileSystemType.Folder)).toBe(false);
  });

  it('should return true when checking for a folder with Folder type', () => {
    const app = createMockApp({ folders: ['my-folder'] });
    expect(exists(app, 'my-folder', FileSystemType.Folder)).toBe(true);
  });

  it('should return false when checking for a folder with File type', () => {
    const app = createMockApp({ folders: ['my-folder'] });
    expect(exists(app, 'my-folder', FileSystemType.File)).toBe(false);
  });
});

describe('trimMarkdownExtension', () => {
  it('should trim the .md extension from a markdown file', () => {
    const app = createMockApp({ files: [{ path: 'folder/note.md' }] });
    const file = app.vault.getAbstractFileByPath('folder/note.md') as TFile;
    expect(trimMarkdownExtension(app, file)).toBe('folder/note');
  });

  it('should not trim the extension from a non-markdown file', () => {
    const app = createMockApp({ files: [{ extension: 'canvas', path: 'drawing.canvas' }] });
    const file = app.vault.getAbstractFileByPath('drawing.canvas') as TFile;
    expect(trimMarkdownExtension(app, file)).toBe('drawing.canvas');
  });

  it('should not trim from a folder', () => {
    const app = createMockApp({ folders: ['my-folder'] });
    const folder = app.vault.getAbstractFileByPath('my-folder') as TFolder;
    expect(trimMarkdownExtension(app, folder)).toBe('my-folder');
  });
});
