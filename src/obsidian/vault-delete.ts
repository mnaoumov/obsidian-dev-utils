/**
 * @packageDocumentation
 *
 * This module provides deletion utilities that require metadata cache access.
 */

import type { App } from 'obsidian';

import { Notice } from 'obsidian';

import type { PathOrAbstractFile } from './file-system.ts';

import { printError } from '../error.ts';
import {
  getAbstractFileOrNull,
  isFile,
  isFolder
} from './file-system.ts';
import { t } from './i18n/i18n.ts';
import { getBacklinksForFileSafe } from './metadata-cache.ts';
import {
  isEmptyFolder,
  listSafe,
  trashSafe
} from './vault.ts';

/**
 * Deletes an abstract file safely from the vault, but only if it is not referenced by other notes.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or abstract file to delete.
 * @param deletedNotePath - Optional. The path of the note that triggered the removal.
 * @param shouldReportUsedAttachments - Optional. If `true`, a notice will be shown for each attachment that is still used by other notes.
 * @param shouldDeleteEmptyFolders - Optional. If `true`, empty folders will be deleted.
 * @returns A {@link Promise} that resolves to a boolean indicating whether the removal was successful.
 */
export async function deleteIfNotUsed(
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

  /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; the false branch of isFile leads to isFolder. */
  if (isFile(file)) {
    /* v8 ignore stop */
    const backlinks = await getBacklinksForFileSafe(app, file);
    if (deletedNotePath) {
      backlinks.clear(deletedNotePath);
    }
    if (backlinks.count() !== 0) {
      if (shouldReportUsedAttachments) {
        new Notice(t(($) => $.obsidianDevUtils.notices.attachmentIsStillUsed, { attachmentPath: file.path }));
      }
      canDelete = false;
    }
    /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; defensive fallback. */
  } else if (isFolder(file)) {
    /* v8 ignore stop */
    const listedFiles = await listSafe(app, file);
    for (const child of [...listedFiles.files, ...listedFiles.folders]) {
      canDelete &&= await deleteIfNotUsed(app, child, deletedNotePath, shouldReportUsedAttachments);
    }

    canDelete &&= await isEmptyFolder(app, file);
  }

  if (canDelete) {
    try {
      await trashSafe(app, file);
    } catch (e) {
      printError(new Error(`Failed to delete ${file.path}`, { cause: e }));
      canDelete = false;
    }
  }

  return canDelete;
}
