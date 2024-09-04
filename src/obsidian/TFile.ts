/**
 * @packageDocumentation TFile
 * This module provides utility functions for working with TFile instances in Obsidian.
 */

import {
  App,
  TFile
} from 'obsidian';

/**
 * Represents a path or a file.
 */
export type PathOrFile = string | TFile;

/**
 * Retrieves a TFile object based on the provided path or file.
 *
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or file to retrieve the TFile object for.
 * @returns The TFile object corresponding to the provided path or file.
 * @throws Error if the file is not found.
 */
export function getFile(app: App, pathOrFile: PathOrFile): TFile {
  const file = getFileOrNull(app, pathOrFile);
  if (!file) {
    throw new Error(`File not found: ${pathOrFile as string}`);
  }

  return file;
}

/**
 * Retrieves a TFile object based on the provided path or file.
 * If the provided argument is already a TFile object, it is returned as is.
 * Otherwise, the function uses the app's vault to retrieve the TFile object by its path.
 * @param app - The Obsidian App instance.
 * @param pathOrFile - The path or TFile object.
 * @returns The TFile object if found, otherwise null.
 */
export function getFileOrNull(app: App, pathOrFile: PathOrFile): TFile | null {
  return pathOrFile instanceof TFile ? pathOrFile : app.vault.getFileByPath(pathOrFile);
}
