/**
 * @packageDocumentation TFile
 * This module provides utility functions for working with TFile instances in Obsidian.
 */

import {
  App,
  TFile
} from 'obsidian';
import { createTFileInstance } from 'obsidian-typings/implementations';
import { getAbstractFileOrNull } from './TAbstractFile.ts';

/**
 * Represents a path or a file.
 */
export type PathOrFile = string | TFile;

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
  if (file instanceof TFile) {
    return file;
  }
  return null;
}
