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
 * @returns A {@link Promise} that resolves to a boolean indicating whether the removal was successful.
 */
export async function deleteIfNotUsed(params: DeleteIfNotUsedParams): Promise<boolean> {
  const file = getAbstractFileOrNull(params.app, params.pathOrFile);

  if (!file) {
    return false;
  }

  let canDelete = isFile(file) || (params.shouldDeleteEmptyFolders ?? true);

  /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; the false branch of isFile leads to isFolder. */
  if (isFile(file)) {
    /* v8 ignore stop */
    const backlinks = await getBacklinksForFileSafe(params.app, file);
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
      }));
    }

    canDelete &&= await isEmptyFolder(params.app, file);
  }

  if (canDelete) {
    try {
      await trashSafe(params.app, file);
    } catch (e) {
      printError(new Error(`Failed to delete ${file.path}`, { cause: e }));
      canDelete = false;
    }
  }

  return canDelete;
}
