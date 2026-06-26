/**
 * @file
 *
 * This module provides utility functions for working with {@link TAbstractFile}, {@link TFile}, and {@link TFolder} instances in Obsidian.
 */

import type { App } from 'obsidian';

import {
  createTFileInstance,
  createTFolderInstance,
  getDataAdapterEx,
  parentFolderPath
} from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  normalizePath,
  TAbstractFile,
  TFile,
  TFolder,
  Vault
} from 'obsidian';

import { normalizeOptionalProperties } from '../object-utils.ts';
import {
  extname,
  resolve
} from '../path.ts';
import { trimEnd } from '../string.ts';
import { ensureNonNullable } from '../type-guards.ts';
import { getCaseInsensitiveFileIndex } from './case-insensitive-file-index.ts';

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
 * A type of file system object.
 */
export enum FileSystemType {
  /**
   * A file.
   */
  File = 'file',
  /**
   * A folder.
   */
  Folder = 'folder'
}

/**
 * Parameters for {@link exists}.
 */
export interface ExistsParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `undefined`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path to check.
   */
  readonly path: string;

  /**
   * The type of the file system object to check. Default is `undefined`.
   */
  readonly type?: FileSystemType;
}

/**
 * Parameters for {@link getAbstractFileOrNull}.
 */
export interface GetAbstractFileOrNullParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `false`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path or abstract file to retrieve.
   */
  readonly pathOrFile: null | PathOrAbstractFile;
}

/**
 * Parameters for {@link getAbstractFile}.
 */
export interface GetAbstractFileParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `false`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path or abstract file to retrieve the abstract file for.
   */
  readonly pathOrFile: PathOrAbstractFile;
}

/**
 * Parameters for {@link getFileOrNull}.
 */
export interface GetFileOrNullParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `false`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path or file.
   */
  readonly pathOrFile: null | PathOrFile;
}

/**
 * Parameters for {@link getFile}.
 */
export interface GetFileParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `false`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path or file to retrieve the file for.
   */
  readonly pathOrFile: PathOrFile;

  /**
   * Whether to include a non-existing file.
   *  If `true`, a new file is created for the provided path.
   *  If `false`, an error is thrown if the file is not found.
   */
  readonly shouldIncludeNonExisting?: boolean;
}

/**
 * Parameters for {@link getFolderOrNull}.
 */
export interface GetFolderOrNullParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `false`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path or folder to retrieve the folder from.
   */
  readonly pathOrFolder: null | PathOrFolder;
}

/**
 * Parameters for {@link getFolder}.
 */
export interface GetFolderParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `false`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path or folder identifier.
   */
  readonly pathOrFolder: PathOrFolder;

  /**
   * Whether to allow the folder to not exist.
   *  If `true`, a new folder is created for the provided path.
   *  If `false`, an error is thrown if the folder is not found.
   */
  readonly shouldIncludeNonExisting?: boolean;
}

/**
 * Parameters for {@link getMarkdownFiles}.
 */
export interface GetMarkdownFilesParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to recursively search for markdown files within subfolders. Default is `false`.
   */
  readonly isRecursive?: boolean;

  /**
   * The path or folder to retrieve the markdown files from.
   */
  readonly pathOrFolder: PathOrFolder;
}

/**
 * A path or an abstract file.
 */
export type PathOrAbstractFile = string | TAbstractFile;

/**
 * A path or a file.
 */
export type PathOrFile = string | TFile;

/**
 * A path or a folder.
 */
export type PathOrFolder = string | TFolder;

/**
 * Parameters for {@link getFileInternal}.
 */
interface GetFileInternalParams {
  /**
   * The Obsidian App instance.
   */
  readonly app: App;

  /**
   * Specifies whether to perform a case-insensitive search. Default is `false`.
   */
  readonly isCaseInsensitive?: boolean;

  /**
   * The path to retrieve the abstract file for.
   */
  readonly path: string;
}

/**
 * Converts an array of abstract files to an array of files.
 *
 * @param abstractFiles - The abstract files to convert.
 * @returns The array of files.
 * @throws Error if any of the abstract files are not files.
 */
export function asArrayOfFiles(abstractFiles: TAbstractFile[]): TFile[] {
  return abstractFiles.map((abstractFile) => asFile(abstractFile));
}

/**
 * Converts an array of abstract files to an array of folders.
 *
 * @param abstractFiles - The abstract files to convert.
 * @returns The array of folders.
 * @throws Error if any of the abstract files are not folders.
 */
export function asArrayOfFolders(abstractFiles: TAbstractFile[]): TFolder[] {
  return abstractFiles.map((abstractFile) => asFolder(abstractFile));
}

/**
 * Converts an abstract file to a file.
 *
 * @param abstractFile - The abstract file to convert.
 * @returns The file.
 * @throws Error if the abstract file is not a file.
 */
export function asFile(abstractFile: null | TAbstractFile): TFile {
  return ensureNonNullable(asFileOrNull(abstractFile), 'Abstract file is not a file');
}

/**
 * Converts an abstract file to a file or `null`.
 *
 * @param abstractFile - The abstract file to convert.
 * @returns The file or `null`.
 * @throws Error if the abstract file is not a file.
 */
export function asFileOrNull(abstractFile: null | TAbstractFile): null | TFile {
  if (abstractFile === null) {
    return null;
  }
  if (abstractFile instanceof TFile) {
    return abstractFile;
  }
  throw new Error('Abstract file is not a file');
}

/**
 * Converts an abstract file to a folder.
 *
 * @param abstractFile - The abstract file to convert.
 * @returns The folder.
 * @throws Error if the abstract file is not a folder.
 */
export function asFolder(abstractFile: null | TAbstractFile): TFolder {
  return ensureNonNullable(asFolderOrNull(abstractFile), 'Abstract file is not a folder');
}

/**
 * Converts an abstract file to a folder or `null`.
 *
 * @param abstractFile - The abstract file to convert.
 * @returns The folder or `null`.
 * @throws Error if the abstract file is not a folder.
 */
export function asFolderOrNull(abstractFile: null | TAbstractFile): null | TFolder {
  if (abstractFile === null) {
    return null;
  }
  if (abstractFile instanceof TFolder) {
    return abstractFile;
  }
  throw new Error('Abstract file is not a folder');
}

/**
 * Checks if the given path or file has the specified extension.
 *
 * @param pathOrFile - The path or abstract file to check.
 * @param extension - The extension to compare against.
 * @returns Returns `true` if the path or file has the specified extension, `false` otherwise.
 */
export function checkExtension(pathOrFile: null | PathOrAbstractFile, extension: string): boolean {
  if (isFile(pathOrFile)) {
    return pathOrFile.extension === extension;
  }

  if (typeof pathOrFile === 'string') {
    // Compare the path's own extension instead of resolving the file.
    // Resolving a string path is O(vault) on a miss on a case-insensitive filesystem.
    // That miss is the hot path during deletion cascades.
    // Obsidian lowercases a file's canonical extension, so compare case-insensitively.
    return extname(pathOrFile).slice(1).toLowerCase() === extension;
  }

  return false;
}

/**
 * Checks if the given path exists.
 *
 * @param params - The parameters for the check.
 * @returns `true` if the path exists, `false` otherwise.
 */
export function exists(params: ExistsParams): boolean {
  const {
    app,
    isCaseInsensitive,
    path,
    type
  } = params;
  const abstractFile = getAbstractFileOrNull(normalizeOptionalProperties<GetAbstractFileOrNullParams>({
    app,
    isCaseInsensitive,
    pathOrFile: path
  }));
  if (!abstractFile) {
    return false;
  }

  if (type === undefined) {
    return true;
  }

  return getFileSystemType(abstractFile) === type;
}

/**
 * Retrieves the TAbstractFile object for the given path or abstract file.
 *
 * @param params - The parameters for the retrieval.
 * @returns The abstract file.
 * @throws Error if the abstract file is not found.
 */
export function getAbstractFile(params: GetAbstractFileParams): TAbstractFile {
  const {
    app,
    isCaseInsensitive,
    pathOrFile
  } = params;
  return ensureNonNullable(
    getAbstractFileOrNull(normalizeOptionalProperties<GetAbstractFileOrNullParams>({
      app,
      isCaseInsensitive,
      pathOrFile
    })),
    `Abstract file not found: ${pathOrFile as string}`
  );
}

/**
 * Retrieves an abstract file or `null` based on the provided path or abstract file.
 *
 * @param params - The parameters for the retrieval.
 * @returns The abstract file if found, otherwise `null`.
 */
export function getAbstractFileOrNull(params: GetAbstractFileOrNullParams): null | TAbstractFile {
  const {
    app,
    isCaseInsensitive,
    pathOrFile
  } = params;
  if (pathOrFile === null) {
    return null;
  }

  if (isAbstractFile(pathOrFile)) {
    if (isFile(pathOrFile)) {
      return app.vault.getFileByPath(pathOrFile.path) ?? pathOrFile;
    }
    /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; defensive fallback. */
    if (isFolder(pathOrFile)) {
      return app.vault.getFolderByPath(pathOrFile.path) ?? pathOrFile;
    }
    /* v8 ignore stop */
    /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; defensive fallback. */
    return app.vault.getAbstractFileByPath(pathOrFile.path) ?? pathOrFile;
    /* v8 ignore stop */
  }

  const file = getFileInternal(normalizeOptionalProperties<GetFileInternalParams>({
    app,
    isCaseInsensitive,
    path: pathOrFile
  }));

  if (file) {
    return file;
  }

  const resolvedPath = getResolvedPath(pathOrFile);

  if (resolvedPath === pathOrFile) {
    return null;
  }

  return getFileInternal(normalizeOptionalProperties<GetFileInternalParams>({
    app,
    isCaseInsensitive,
    path: resolvedPath
  }));
}

/**
 * Retrieves a file based on the provided path or file.
 *
 * @param params - The parameters for the retrieval.
 * @returns The file corresponding to the provided path or file.
 * @throws Error if the file is not found.
 */
export function getFile(params: GetFileParams): TFile {
  const {
    app,
    isCaseInsensitive,
    pathOrFile,
    shouldIncludeNonExisting
  } = params;
  let file = getFileOrNull(normalizeOptionalProperties<GetFileOrNullParams>({
    app,
    isCaseInsensitive,
    pathOrFile
  }));
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
 * Retrieves a file or `null` based on the provided path or file.
 * If the provided argument is already a file, it is returned as is.
 * Otherwise, the function uses the app's vault to retrieve the file by its path.
 *
 * @param params - The parameters for the retrieval.
 * @returns The file if found, otherwise `null`.
 */
export function getFileOrNull(params: GetFileOrNullParams): null | TFile {
  const {
    app,
    isCaseInsensitive,
    pathOrFile
  } = params;
  const file = getAbstractFileOrNull(normalizeOptionalProperties<GetAbstractFileOrNullParams>({
    app,
    isCaseInsensitive,
    pathOrFile
  }));
  if (isFile(file)) {
    return file;
  }
  return null;
}

/**
 * Gets the type of a file system object.
 *
 * @param abstractFile - The abstract file to get the type of.
 * @returns The type of the abstract file.
 * @throws Error if the abstract file is not a file or a folder.
 */
export function getFileSystemType(abstractFile: TAbstractFile): FileSystemType {
  if (isFile(abstractFile)) {
    return FileSystemType.File;
  }
  if (isFolder(abstractFile)) {
    return FileSystemType.Folder;
  }
  throw new Error('Abstract file is not a file or a folder');
}

/**
 * Retrieves a folder based on the provided app and pathOrFolder.
 *
 * @param params - The parameters for the retrieval.
 * @returns The retrieved folder.
 * @throws If the folder is not found.
 */
export function getFolder(params: GetFolderParams): TFolder {
  const {
    app,
    isCaseInsensitive,
    pathOrFolder,
    shouldIncludeNonExisting
  } = params;
  let folder = getFolderOrNull(normalizeOptionalProperties<GetFolderOrNullParams>({
    app,
    isCaseInsensitive,
    pathOrFolder
  }));
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
 * Retrieves a folder or `null` based on the provided path or folder.
 *
 * @param params - The parameters for the retrieval.
 * @returns The folder if found, otherwise `null`.
 */
export function getFolderOrNull(params: GetFolderOrNullParams): null | TFolder {
  const {
    app,
    isCaseInsensitive,
    pathOrFolder
  } = params;
  const folder = getAbstractFileOrNull(normalizeOptionalProperties<GetAbstractFileOrNullParams>({
    app,
    isCaseInsensitive,
    pathOrFile: pathOrFolder
  }));
  if (isFolder(folder)) {
    return folder;
  }
  return null;
}

/**
 * Retrieves an array of files representing the markdown files within a specified folder or path.
 *
 * @param params - The parameters for the retrieval.
 * @returns An array of files representing the markdown files.
 */
export function getMarkdownFiles(params: GetMarkdownFilesParams): TFile[] {
  const {
    app,
    isRecursive,
    pathOrFolder
  } = params;
  const folder = getFolder({
    app,
    pathOrFolder
  });

  let markdownFiles: TFile[] = [];

  if (isRecursive) {
    Vault.recurseChildren(folder, (abstractFile) => {
      if (isMarkdownFile(abstractFile) && abstractFile instanceof TFile) {
        markdownFiles.push(abstractFile);
      }
    });
  } else {
    markdownFiles = folder.children.filter((file) => isMarkdownFile(file)) as TFile[];
  }

  markdownFiles = markdownFiles.sort((a, b) => a.path.localeCompare(b.path));
  return markdownFiles;
}

/**
 * Retrieves the file for the given path or creates a new one if it does not exist.
 *
 * @param app - The Obsidian App instance.
 * @param path - The path of the file to retrieve or create.
 * @returns The file representing the file
 */
export async function getOrCreateFile(app: App, path: string): Promise<TFile> {
  const file = getFileOrNull({
    app,
    pathOrFile: path
  });
  if (file) {
    return file;
  }

  const folderPath = parentFolderPath(path);
  await getOrCreateFolder(app, folderPath);

  return await app.vault.create(path, '');
}

/**
 * Retrieves the folder for the given path or creates a new one if it does not exist.
 *
 * @param app - The Obsidian App instance.
 * @param path - The path of the folder to retrieve or create.
 * @returns The folder representing the folder.
 */
export async function getOrCreateFolder(app: App, path: string): Promise<TFolder> {
  const folder = getFolderOrNull({
    app,
    pathOrFolder: path
  });
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

  const file = getAbstractFileOrNull({
    app,
    pathOrFile
  });
  if (file) {
    return file.path;
  }

  return getResolvedPath(pathOrFile);
}

/**
 * Checks if the given file is an instance of abstract file.
 *
 * @param file - The file to check.
 * @returns A boolean indicating whether the file is an instance of abstract file.
 */
export function isAbstractFile(file: unknown): file is TAbstractFile {
  return file instanceof TAbstractFile;
}

/**
 *   Checks if the given file is a base file.
 *
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a base file.
 */
export function isBaseFile(pathOrFile: null | PathOrAbstractFile): boolean {
  return checkExtension(pathOrFile, BASE_FILE_EXTENSION);
}

/**
 * Checks if the given file is a canvas file.
 *
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a canvas file or not.
 */
export function isCanvasFile(pathOrFile: null | PathOrAbstractFile): boolean {
  return checkExtension(pathOrFile, CANVAS_FILE_EXTENSION);
}

/**
 * Checks if the given file is an instance of file.
 *
 * @param file - The file to check.
 * @returns A boolean indicating whether the file is an instance of file.
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
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a Markdown file.
 */
export function isMarkdownFile(pathOrFile: null | PathOrAbstractFile): boolean {
  return checkExtension(pathOrFile, MARKDOWN_FILE_EXTENSION);
}

/**
 * Checks if the given file is a note.
 *
 * @param pathOrFile - The path or file to check.
 * @returns A boolean indicating whether the file is a note.
 */
export function isNote(pathOrFile: null | PathOrAbstractFile): boolean {
  return isMarkdownFile(pathOrFile) || isCanvasFile(pathOrFile) || isBaseFile(pathOrFile);
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

  return trimEnd({
    str: file.path,
    suffix: `.${MARKDOWN_FILE_EXTENSION}`
  });
}

function getFileInternal(params: GetFileInternalParams): null | TAbstractFile {
  const {
    app,
    path
  } = params;
  let { isCaseInsensitive } = params;
  isCaseInsensitive ??= getDataAdapterEx(app).insensitive;
  if (isCaseInsensitive) {
    const caseInsensitiveFileIndex = getCaseInsensitiveFileIndex(app);
    if (caseInsensitiveFileIndex) {
      return caseInsensitiveFileIndex.get(path);
    }
    return app.vault.getAbstractFileByPathInsensitive(path);
  }

  return app.vault.getAbstractFileByPath(path);
}

function getResolvedPath(path: string): string {
  return normalizePath(resolve('/', path));
}
