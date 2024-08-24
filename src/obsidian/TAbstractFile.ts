/**
 * @packageDocumentation TAbstractFile
 * This module provides utility functions for working with abstract files in Obsidian.
 */

import {
  App,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";
import { trimEnd } from "../String.ts";
import { extname } from "../Path.ts";

/**
 * The file extension for Markdown files.
 */
export const MARKDOWN_FILE_EXTENSION = "md";

/**
 * Represents the file extension for canvas files.
 */
export const CANVAS_FILE_EXTENSION = "canvas";

/**
 * Represents a path or an instance of TAbstractFile.
 */
export type PathOrAbstractFile = string | TAbstractFile;

/**
 * Retrieves the TAbstractFile object for the given path or abstract file.
 *
 * @param app - The App instance.
 * @param pathOrFile - The path or abstract file to retrieve the TAbstractFile for.
 * @returns The TAbstractFile object.
 * @throws Error if the abstract file is not found.
 */
export function getAbstractFile(app: App, pathOrFile: PathOrAbstractFile): TAbstractFile {
  const file = getAbstractFileOrNull(app, pathOrFile);
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
 * @returns The instance of TAbstractFile if found, otherwise null.
 */
export function getAbstractFileOrNull(app: App, pathOrFile: PathOrAbstractFile): TAbstractFile | null {
  return pathOrFile instanceof TAbstractFile ? pathOrFile : app.vault.getAbstractFileByPath(pathOrFile);
}

/**
 * Checks if the given file is a note.
 * @param file - The file to check.
 * @returns A boolean indicating whether the file is a note.
 */
export function isNote(file: TAbstractFile | null): file is TFile {
  return isMarkdownFile(file) || isCanvasFile(file);
}

/**
 * Checks if the given file is a Markdown file.
 *
 * @param pathOrFile - The file to check.
 * @returns A boolean indicating whether the file is a Markdown file.
 */
export function isMarkdownFile(pathOrFile: PathOrAbstractFile | null): boolean {
  return checkExtension(pathOrFile, MARKDOWN_FILE_EXTENSION);
}

/**
 * Checks if the given file is a canvas file.
 *
 * @param file - The file to check.
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

  return trimEnd(file.path, "." + MARKDOWN_FILE_EXTENSION);
}

/**
 * Checks if the given file is an instance of TFile.
 *
 * @param file - The file to check.
 * @returns A boolean indicating whether the file is an instance of TFile.
 */
export function isFile(file: TAbstractFile | null): file is TFile {
  return file instanceof TFile;
}

/**
 * Checks if the given file is a folder.
 *
 * @param file - The file to check.
 * @returns `true` if the file is a folder, `false` otherwise.
 */
export function isFolder(file: TAbstractFile | null): file is TFolder {
  return file instanceof TFolder;
}

/**
 * Returns the path of the given `pathOrFile`.
 *
 * @param pathOrFile - The path or abstract file.
 * @returns The path of the `pathOrFile`.
 */
export function getPath(pathOrFile: PathOrAbstractFile): string {
  return pathOrFile instanceof TAbstractFile ? pathOrFile.path : pathOrFile;
}
