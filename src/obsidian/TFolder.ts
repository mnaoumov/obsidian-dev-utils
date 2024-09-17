/**
 * @packageDocumentation TFolder
 * This module provides utility functions for working with TFolder instances in Obsidian.
 */

import type { App } from 'obsidian';
import {
  TFile,
  TFolder,
  Vault
} from 'obsidian';
import { createTFolderInstance } from 'obsidian-typings/implementations';

import { getAbstractFileOrNull, isMarkdownFile } from './TAbstractFile.ts';

/**
 * Represents a path or an instance of TFolder.
 */
export type PathOrFolder = string | TFolder;

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
  if (folder instanceof TFolder) {
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
