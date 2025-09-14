/**
 * @packageDocumentation
 *
 * This module provides utility functions for working with TAbstractFile, TFile, and TFolder instances in Obsidian.
 */

import type { App } from 'obsidian';

import {
  normalizePath,
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

import {
  extname,
  resolve
} from '../Path.ts';
import { trimEnd } from '../String.ts';

/**
 * A file extension for `base` files.
 */
export const BASE_FILE_EXTENSION = 'base';

/**
 * A file extension for `canvas` files.
 */
export const CANVAS_FILE_EXTENSION = 'canvas';

/**
 * A file extension for `markdown` files.
 */
export const MARKDOWN_FILE_EXTENSION = 'md';

/**
 * A path or an instance of {@link TAbstractFile}.
 */
export type PathOrAbstractFile = string | TAbstractFile;

/**
 * A path or a {@link TFile}.
 */
export type PathOrFile = string | TFile;

/**
 * A path or a {@link TFolder}.
 */
export type PathOrFolder = string | TFolder;

/**
 * Checks if the given path or file has the specified extension.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or abstract file to check.
 * @param extension - The extension to compare against.
 * @returns Returns `true` if the path or file has the specified extension, `false` otherwise.
 */
export function checkExtension(app: App, pathOrFile: null | PathOrAbstractFile, extension: string): boolean {
  if (isFile(pathOrFile)) {
    return pathOrFile.extension === extension;
  }

  if (typeof pathOrFile === 'string') {
    const file = getFileOrNull(app, pathOrFile);
    if (file) {
      return file.extension === extension;
    }

    return extname(pathOrFile).slice(1) === extension;
  }

  return false;
}

/**
 * Retrieves the TAbstractFile object for the given path or abstract file.
 *
 * @param app - The App instance.
 * @param pathOrFile - The path or abstract file to retrieve the TAbstractFile for.
 * @param isCaseInsensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TAbstractFile object.
 * @throws Error if the abstract file is not found.
 */
export function getAbstractFile(app: App, pathOrFile: PathOrAbstractFile, isCaseInsensitive?: boolean): TAbstractFile {
  const file = getAbstractFileOrNull(app, pathOrFile, isCaseInsensitive);
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
 * @param isCaseInsensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The instance of TAbstractFile if found, otherwise null.
 */
export function getAbstractFileOrNull(app: App, pathOrFile: null | PathOrAbstractFile, isCaseInsensitive?: boolean): null | TAbstractFile {
  if (pathOrFile === null) {
    return null;
  }

  if (isAbstractFile(pathOrFile)) {
    return app.vault.fileMap[pathOrFile.path] ?? pathOrFile;
  }

  const file = getFileInternal(app, pathOrFile, isCaseInsensitive);

  if (file) {
    return file;
  }

  const resolvedPath = getResolvedPath(pathOrFile);

  if (resolvedPath === pathOrFile) {
    return null;
  }

  return getFileInternal(app, resolvedPath, isCaseInsensitive);
}

/**
 * Retrieves a TFile object based on the provided path or file.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or file to retrieve the TFile object for.
 * @param shouldIncludeNonExisting - Whether to include a non-existing file.
 *  If `true`, a new TFile object is created for the provided path.
 *  If `false`, an error is thrown if the file is not found.
 * @param isCaseInsensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TFile object corresponding to the provided path or file.
 * @throws Error if the file is not found.
 */
export function getFile(app: App, pathOrFile: PathOrFile, shouldIncludeNonExisting?: boolean, isCaseInsensitive?: boolean): TFile {
  let file = getFileOrNull(app, pathOrFile, isCaseInsensitive);
  if (!file) {
    if (shouldIncludeNonExisting) {
      file = createTFileInstance(app, pathOrFile as string);
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
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or TFile object.
 * @param isCaseInsensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TFile object if found, otherwise null.
 */
export function getFileOrNull(app: App, pathOrFile: null | PathOrFile, isCaseInsensitive?: boolean): null | TFile {
  const file = getAbstractFileOrNull(app, pathOrFile, isCaseInsensitive);
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
 * @param shouldIncludeNonExisting - Whether to allow the folder to not exist.
 *  If `true`, a new TFolder object is created for the provided path.
 *  If `false`, an error is thrown if the folder is not found.
 * @param isCaseInsensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The retrieved TFolder object.
 * @throws If the folder is not found.
 */
export function getFolder(app: App, pathOrFolder: PathOrFolder, shouldIncludeNonExisting?: boolean, isCaseInsensitive?: boolean): TFolder {
  let folder = getFolderOrNull(app, pathOrFolder, isCaseInsensitive);
  if (!folder) {
    if (shouldIncludeNonExisting) {
      folder = createTFolderInstance(app, pathOrFolder as string);
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
 * @param isCaseInsensitive - Specifies whether to perform a case-insensitive search. Default is `false`.
 * @returns The TFolder object if found, otherwise null.
 */
export function getFolderOrNull(app: App, pathOrFolder: null | PathOrFolder, isCaseInsensitive?: boolean): null | TFolder {
  const folder = getAbstractFileOrNull(app, pathOrFolder, isCaseInsensitive);
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

  if (isRecursive) {
    Vault.recurseChildren(folder, (abstractFile) => {
      if (isMarkdownFile(app, abstractFile)) {
        markdownFiles.push(abstractFile as TFile);
      }
    });
  } else {
    markdownFiles = folder.children.filter((file) => isMarkdownFile(app, file)) as TFile[];
  }

  markdownFiles = markdownFiles.sort((a, b) => a.path.localeCompare(b.path));
  return markdownFiles;
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

/**
 * Returns the path of the given `pathOrFile`.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or abstract file.
 * @returns The path of the `pathOrFile`.
 */
export function getPath(app: App, pathOrFile: PathOrAbstractFile): string {
  if (isAbstractFile(pathOrFile)) {
    return pathOrFile.path;
  }

  const file = getAbstractFileOrNull(app, pathOrFile);
  if (file) {
    return file.path;
  }

  return getResolvedPath(pathOrFile);
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
 *   Checks if the given file is a base file.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a base file.
 */
export function isBaseFile(app: App, pathOrFile: null | PathOrAbstractFile): boolean {
  return checkExtension(app, pathOrFile, BASE_FILE_EXTENSION);
}

/**
 * Checks if the given file is a canvas file.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a canvas file or not.
 */
export function isCanvasFile(app: App, pathOrFile: null | PathOrAbstractFile): boolean {
  return checkExtension(app, pathOrFile, CANVAS_FILE_EXTENSION);
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
 * Checks if the given file is a Markdown file.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a Markdown file.
 */
export function isMarkdownFile(app: App, pathOrFile: null | PathOrAbstractFile): boolean {
  return checkExtension(app, pathOrFile, MARKDOWN_FILE_EXTENSION);
}

/**
 * Checks if the given file is a note.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a note.
 */
export function isNote(app: App, pathOrFile: null | PathOrAbstractFile): boolean {
  return isMarkdownFile(app, pathOrFile) || isCanvasFile(app, pathOrFile) || isBaseFile(app, pathOrFile);
}

/**
 * Trims the markdown extension from the file path if the file is a markdown file.
 * If the file is not a markdown file, the original file path is returned.
 *
 * @param app - The Obsidian App instance.
 * @param file - The file to trim the markdown extension from.
 * @returns The file path with the markdown extension trimmed.
 */
export function trimMarkdownExtension(app: App, file: TAbstractFile): string {
  if (!isMarkdownFile(app, file)) {
    return file.path;
  }

  return trimEnd(file.path, `.${MARKDOWN_FILE_EXTENSION}`);
}

function getFileInternal(app: App, path: string, isCaseInsensitive?: boolean): null | TAbstractFile {
  if (isCaseInsensitive) {
    return app.vault.getAbstractFileByPathInsensitive(path);
  }

  return app.vault.getAbstractFileByPath(path) as null | TFile;
}

function getResolvedPath(path: string): string {
  return normalizePath(resolve('/', path));
}
