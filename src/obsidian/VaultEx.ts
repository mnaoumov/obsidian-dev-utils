/**
 * @packageDocumentation
 *
 * This module provides additional utilities for working with the Obsidian Vault.
 *
 * It has to be extracted from `Vault` because of circular dependencies.
 */

import type { App } from 'obsidian';

import type {
  PathOrAbstractFile,
  PathOrFolder
} from './FileSystem.ts';

import { printError } from '../Error.ts';
import {
  getAbstractFileOrNull,
  getFolderOrNull,
  isFile,
  isFolder
} from './FileSystem.ts';
import { getBacklinksForFileSafe } from './MetadataCache.ts';
import {
  isEmptyFolder,
  listSafe
} from './Vault.ts';

/**
 * Removes empty folder hierarchy starting from the given folder.
 *
 * @param app - The application instance.
 * @param pathOrFolder - The folder to start removing empty hierarchy from.
 * @returns A {@link Promise} that resolves when the empty hierarchy is deleted.
 */
export async function deleteEmptyFolderHierarchy(app: App, pathOrFolder: null | PathOrFolder): Promise<void> {
  let folder = getFolderOrNull(app, pathOrFolder);

  while (folder) {
    if (!await isEmptyFolder(app, folder)) {
      return;
    }
    const parent = folder.parent;
    await deleteSafe(app, folder.path);
    folder = parent;
  }
}

/**
 * Deletes abstract file safely from the vault.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or abstract file to delete.
 * @param deletedNotePath - Optional. The path of the note that triggered the removal.
 * @param shouldReportUsedAttachments - Optional. If `true`, a notice will be shown for each attachment that is still used by other notes.
 * @param shouldDeleteEmptyFolders - Optional. If `true`, empty folders will be deleted.
 * @returns A {@link Promise} that resolves to a boolean indicating whether the removal was successful.
 */
export async function deleteSafe(
  app: App,
  pathOrFile: PathOrAbstractFile,
  deletedNotePath?: string,
  shouldReportUsedAttachments?: boolean,
  shouldDeleteEmptyFolders?: boolean
): Promise<boolean> {
  const file = getAbstractFileOrNull(app, pathOrFile);

  if (!file) {
    return false;
  }

  let canDelete = isFile(file) || (shouldDeleteEmptyFolders ?? true);

  if (isFile(file)) {
    const backlinks = await getBacklinksForFileSafe(app, file);
    if (deletedNotePath) {
      backlinks.clear(deletedNotePath);
    }
    if (backlinks.count() !== 0) {
      if (shouldReportUsedAttachments) {
        new Notice(`Attachment ${file.path} is still used by other notes. It will not be deleted.`);
      }
      canDelete = false;
    }
  } else if (isFolder(file)) {
    const listedFiles = await listSafe(app, file);
    for (const child of [...listedFiles.files, ...listedFiles.folders]) {
      canDelete &&= await deleteSafe(app, child, deletedNotePath, shouldReportUsedAttachments);
    }

    canDelete &&= await isEmptyFolder(app, file);
  }

  if (canDelete) {
    try {
      await app.fileManager.trashFile(file);
    } catch (e) {
      if (await app.vault.exists(file.path)) {
        printError(new Error(`Failed to delete ${file.path}`, { cause: e }));
        canDelete = false;
      }
    }
  }

  return canDelete;
}
