/**
 * @packageDocumentation FileSystem
 * This module provides utility functions for working with TAbstractFile, TFile, and TFolder instances in Obsidian.
 */

import {
  App,
  TAbstractFile,
  TFile,
  TFolder,
  Vault
} from 'obsidian';
import {
  createTFileInstance,
  createTFolderInstance,
  parentFolderPath
} from 'obsidian-typings/implementations';

import { extname } from '../Path.ts';
import { trimEnd } from '../String.ts';

/**
 * The file extension for Markdown files.
 */
export const MARKDOWN_FILE_EXTENSION = 'md';

/**
 * Represents the file extension for canvas files.
 */
export const CANVAS_FILE_EXTENSION = 'canvas';

/**
 * Represents a path or an instance of TAbstractFile.
 */
export type PathOrAbstractFile = string | TAbstractFile;

/**
 * Represents a path or a file.
 */
export type PathOrFile = string | TFile;

/**
 * Represents a path or an instance of TFolder.
 */
export type PathOrFolder = string | TFolder;

/**
 * Retrieves the TAbstractFile object for the given path or abstract file.
 *
 * @param app - The App instance.
 * @param pathOrFile - The path or abstract file to retrieve the TAbstractFile for.
 * @param insensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TAbstractFile object.
 * @throws Error if the abstract file is not found.
 */
export function getAbstractFile(app: App, pathOrFile: PathOrAbstractFile, insensitive?: boolean): TAbstractFile {
  const file = getAbstractFileOrNull(app, pathOrFile, insensitive);
  if (!file) {
    throw new Error(`Abstract file not found: ${pathOrFile as string}`);
  }

  return file;
}

/**
 * Retrieves an instance of TAbstractFile or null based on the provided path or abstract file.
 *
 * @param app - The application instance.
 * @param pathOrFile - The path or abstract file to retrieve.
 * @param insensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The instance of TAbstractFile if found, otherwise null.
 */
export function getAbstractFileOrNull(app: App, pathOrFile: PathOrAbstractFile | null, insensitive?: boolean): TAbstractFile | null {
  if (pathOrFile === null) {
    return null;
  }

  if (pathOrFile === '.' || pathOrFile === '') {
    return app.vault.getRoot();
  }

  if (isAbstractFile(pathOrFile)) {
    return pathOrFile;
  }

  if (insensitive) {
    return app.vault.getAbstractFileByPathInsensitive(pathOrFile);
  }

  return app.vault.getAbstractFileByPath(pathOrFile);
}

/**
 * Retrieves a TFile object based on the provided path or file.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or file to retrieve the TFile object for.
 * @param allowNonExisting - Whether to allow the file to not exist.
 *  If `true`, a new TFile object is created for the provided path.
 *  If `false`, an error is thrown if the file is not found.
 * @param insensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TFile object corresponding to the provided path or file.
 * @throws Error if the file is not found.
 */
export function getFile(app: App, pathOrFile: PathOrFile, allowNonExisting?: boolean, insensitive?: boolean): TFile {
  let file = getFileOrNull(app, pathOrFile, insensitive);
  if (!file) {
    if (allowNonExisting) {
      file = createTFileInstance(app.vault, pathOrFile as string);
    } else {
      throw new Error(`File not found: ${pathOrFile as string}`);
    }
  }

  return file;
}

/**
 * Retrieves a TFile object based on the provided path or file.
 * If the provided argument is already a TFile object, it is returned as is.
 * Otherwise, the function uses the app's vault to retrieve the TFile object by its path.
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or TFile object.
 * @param insensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TFile object if found, otherwise null.
 */
export function getFileOrNull(app: App, pathOrFile: PathOrFile | null, insensitive?: boolean): TFile | null {
  const file = getAbstractFileOrNull(app, pathOrFile, insensitive);
  if (isFile(file)) {
    return file;
  }
  return null;
}

/**
 * Retrieves a TFolder object based on the provided app and pathOrFolder.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFolder - The path or folder identifier.
 * @param allowNonExisting - Whether to allow the folder to not exist.
 *  If `true`, a new TFolder object is created for the provided path.
 *  If `false`, an error is thrown if the folder is not found.
 * @param insensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The retrieved TFolder object.
 * @throws If the folder is not found.
 */
export function getFolder(app: App, pathOrFolder: PathOrFolder, allowNonExisting?: boolean, insensitive?: boolean): TFolder {
  let folder = getFolderOrNull(app, pathOrFolder, insensitive);
  if (!folder) {
    if (allowNonExisting) {
      folder = createTFolderInstance(app.vault, pathOrFolder as string);
    } else {
      throw new Error(`Folder not found: ${pathOrFolder as string}`);
    }
  }

  return folder;
}

/**
 * Retrieves a TFolder object or null based on the provided path or folder.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFolder - The path or folder to retrieve the TFolder from.
 * @param insensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TFolder object if found, otherwise null.
 */
export function getFolderOrNull(app: App, pathOrFolder: PathOrFolder | null, insensitive?: boolean): TFolder | null {
  const folder = getAbstractFileOrNull(app, pathOrFolder, insensitive);
  if (isFolder(folder)) {
    return folder;
  }
  return null;
}

/**
 * Retrieves an array of TFile objects representing the markdown files within a specified folder or path.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFolder - The path or folder to retrieve the markdown files from.
 * @param isRecursive - Optional. Specifies whether to recursively search for markdown files within subfolders. Default is false.
 * @returns An array of TFile objects representing the markdown files.
 */
export function getMarkdownFiles(app: App, pathOrFolder: PathOrFolder, isRecursive?: boolean): TFile[] {
  const folder = getFolder(app, pathOrFolder);

  let markdownFiles: TFile[] = [];

  if (!isRecursive) {
    markdownFiles = folder.children.filter((file) => isMarkdownFile(file)) as TFile[];
  } else {
    Vault.recurseChildren(folder, (abstractFile) => {
      if (isMarkdownFile(abstractFile)) {
        markdownFiles.push(abstractFile as TFile);
      }
    });
  }

  markdownFiles = markdownFiles.sort((a, b) => a.path.localeCompare(b.path));
  return markdownFiles;
}

/**
 * Checks if the given file is an instance of TAbstractFile.
 *
 * @param file - The file to check.
 * @returns A boolean indicating whether the file is an instance of TAbstractFile.
 */
export function isAbstractFile(file: unknown): file is TAbstractFile {
  return file instanceof TAbstractFile;
}

/**
 * Checks if the given file is an instance of TFile.
 *
 * @param file - The file to check.
 * @returns A boolean indicating whether the file is an instance of TFile.
 */
export function isFile(file: unknown): file is TFile {
  return file instanceof TFile;
}

/**
 * Checks if the given file is a folder.
 *
 * @param file - The file to check.
 * @returns `true` if the file is a folder, `false` otherwise.
 */
export function isFolder(file: unknown): file is TFolder {
  return file instanceof TFolder;
}

/**
 * Checks if the given file is a note.
 *
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a note.
 */
export function isNote(pathOrFile: PathOrAbstractFile | null): boolean {
  return isMarkdownFile(pathOrFile) || isCanvasFile(pathOrFile);
}

/**
 * Checks if the given file is a Markdown file.
 *
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a Markdown file.
 */
export function isMarkdownFile(pathOrFile: PathOrAbstractFile | null): boolean {
  return checkExtension(pathOrFile, MARKDOWN_FILE_EXTENSION);
}

/**
 * Checks if the given file is a canvas file.
 *
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a canvas file or not.
 */
export function isCanvasFile(pathOrFile: PathOrAbstractFile | null): boolean {
  return checkExtension(pathOrFile, CANVAS_FILE_EXTENSION);
}

/**
 * Checks if the given path or file has the specified extension.
 *
 * @param pathOrFile - The path or abstract file to check.
 * @param extension - The extension to compare against.
 * @returns Returns `true` if the path or file has the specified extension, `false` otherwise.
 */
export function checkExtension(pathOrFile: PathOrAbstractFile | null, extension: string): boolean {
  if (pathOrFile === null) {
    return false;
  }
  return extname(getPath(pathOrFile)).toLowerCase().slice(1) === extension.toLowerCase();
}

/**
 * Trims the markdown extension from the file path if the file is a markdown file.
 * If the file is not a markdown file, the original file path is returned.
 *
 * @param file - The file to trim the markdown extension from.
 * @returns The file path with the markdown extension trimmed.
 */
export function trimMarkdownExtension(file: TAbstractFile): string {
  if (!isMarkdownFile(file)) {
    return file.path;
  }

  return trimEnd(file.path, '.' + MARKDOWN_FILE_EXTENSION);
}

/**
 * Returns the path of the given `pathOrFile`.
 *
 * @param pathOrFile - The path or abstract file.
 * @returns The path of the `pathOrFile`.
 */
export function getPath(pathOrFile: PathOrAbstractFile): string {
  return isAbstractFile(pathOrFile) ? pathOrFile.path : pathOrFile;
}

/**
 * Retrieves the TFile object for the given path or creates a new one if it does not exist.
 *
 * @param app - The Obsidian App instance.
 * @param path - The path of the file to retrieve or create.
 * @returns The TFile object representing the file
 */
export async function getOrCreateFile(app: App, path: string): Promise<TFile> {
  const file = getFileOrNull(app, path);
  if (file) {
    return file;
  }

  const folderPath = parentFolderPath(path);
  await getOrCreateFolder(app, folderPath);

  return await app.vault.create(path, '');
}

/**
 * Retrieves the TFolder object for the given path or creates a new one if it does not exist.
 *
 * @param app - The Obsidian App instance.
 * @param path - The path of the folder to retrieve or create.
 * @returns The TFolder object representing the folder.
 */
export async function getOrCreateFolder(app: App, path: string): Promise<TFolder> {
  const folder = getFolderOrNull(app, path);
  if (folder) {
    return folder;
  }

  return await app.vault.createFolder(path);
}
