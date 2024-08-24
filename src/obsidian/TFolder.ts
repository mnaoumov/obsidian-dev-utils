/**
 * @packageDocumentation TFolder
 * This module provides utility functions for working with TFolder instances in Obsidian.
 */

import {
  type App,
  TFile,
  TFolder,
  Vault
} from "obsidian";
import { isMarkdownFile } from "./TAbstractFile.ts";

export type PathOrFolder = string | TFolder

/**
 * Retrieves a TFolder object based on the provided app and pathOrFolder.
 *
 * @param {App} app - The Obsidian app instance.
 * @param {PathOrFolder} pathOrFolder - The path or folder identifier.
 * @returns {TFolder} - The retrieved TFolder object.
 * @throws {Error} - If the folder is not found.
 */
export function getFolder(app: App, pathOrFolder: PathOrFolder): TFolder {
  const folder = getFolderOrNull(app, pathOrFolder);
  if (!folder) {
    throw new Error(`Folder not found: ${pathOrFolder as string}`);
  }

  return folder;
}

/**
 * Retrieves a TFolder object or null based on the provided path or folder.
 *
 * @param {App} app - The Obsidian application instance.
 * @param {PathOrFolder} pathOrFolder - The path or folder to retrieve the TFolder from.
 * @returns {TFolder | null} - The TFolder object if found, otherwise null.
 */
export function getFolderOrNull(app: App, pathOrFolder: PathOrFolder | null): TFolder | null {
  if (pathOrFolder === null) {
    return null;
  }
  return pathOrFolder instanceof TFolder ? pathOrFolder : app.vault.getFolderByPath(pathOrFolder);
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
