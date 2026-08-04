/**
 * @file
 *
 * This module provides deletion utilities that require metadata cache access.
 */

import type { App } from 'obsidian';

import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';
import type { PathOrAbstractFile } from './file-system.ts';

import { printError } from '../error.ts';
import { normalizeOptionalProperties } from '../object-utils.ts';
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
 * The result of {@link deleteIfNotUsed}.
 */
export enum DeleteIfNotUsedResult {
  /**
   * The file/folder was deleted.
   */
  Deleted = 'deleted',

  /**
   * The file/folder was not deleted.
   */
  NotDeleted = 'not-deleted'
}

interface DeleteIfNotUsedParams {
  readonly app: App;
  readonly deletedNotePath?: string;
  readonly pathOrFile: PathOrAbstractFile;
  readonly pluginNoticeComponent?: PluginNoticeComponent;
  readonly shouldDeleteEmptyFolders?: boolean;
}

/**
 * Deletes an abstract file safely from the vault, but only if it is not referenced by other notes.
 *
 * @param params - The parameters for the function.
 * @returns A {@link Promise} that resolves to {@link DeleteIfNotUsedResult.Deleted} if the abstract file
 * was deleted, or {@link DeleteIfNotUsedResult.NotDeleted} if it was kept.
 */
export async function deleteIfNotUsed(params: DeleteIfNotUsedParams): Promise<DeleteIfNotUsedResult> {
  const file = getAbstractFileOrNull({ app: params.app, pathOrFile: params.pathOrFile });

  if (!file) {
    return DeleteIfNotUsedResult.NotDeleted;
  }

  let canDelete = isFile(file) || (params.shouldDeleteEmptyFolders ?? true);

  /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; the false branch of isFile leads to isFolder. */
  if (isFile(file)) {
    /* v8 ignore stop */
    const backlinks = await getBacklinksForFileSafe({ app: params.app, pathOrFile: file });
    if (params.deletedNotePath) {
      backlinks.clear(params.deletedNotePath);
    }
    if (backlinks.count() !== 0) {
      params.pluginNoticeComponent?.showNotice(t(($) => $.obsidianDevUtils.notices.attachmentIsStillUsed, { attachmentPath: file.path }));
      canDelete = false;
    }
    /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; defensive fallback. */
  } else if (isFolder(file)) {
    /* v8 ignore stop */
    const listedFiles = await listSafe(params.app, file);
    for (const child of [...listedFiles.files, ...listedFiles.folders]) {
      canDelete &&= await deleteIfNotUsed(normalizeOptionalProperties<DeleteIfNotUsedParams>({
        app: params.app,
        deletedNotePath: params.deletedNotePath,
        pathOrFile: child,
        pluginNoticeComponent: params.pluginNoticeComponent,
        shouldDeleteEmptyFolders: params.shouldDeleteEmptyFolders
      })) === DeleteIfNotUsedResult.Deleted;
    }

    canDelete &&= await isEmptyFolder(params.app, file);
  }

  if (canDelete) {
    try {
      await trashSafe(params.app, file);
    } catch (error) {
      printError(new Error(`Failed to delete ${file.path}`, { cause: error }));
      canDelete = false;
    }
  }

  return canDelete ? DeleteIfNotUsedResult.Deleted : DeleteIfNotUsedResult.NotDeleted;
}
