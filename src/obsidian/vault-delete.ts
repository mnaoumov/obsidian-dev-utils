/**
 * @file
 *
 * This module provides deletion utilities that require metadata cache access.
 */

import type {
  App,
  TAbstractFile,
  TFile
} from 'obsidian';

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
  NotDeleted = 'not-deleted',

  /**
   * The file was still used, and {@link DeleteIfNotUsedParams.rescueStillUsedFile} moved it out of the way
   * instead of it being deleted or left where it was.
   */
  Rescued = 'rescued'
}

/**
 * Parameters passed to {@link DeleteIfNotUsedParams.rescueStillUsedFile}.
 */
export interface RescueStillUsedFileParams {
  /**
   * The file that is about to be kept because other notes still reference it.
   */
  readonly file: TFile;

  /**
   * The paths of the notes that still reference the file once everything being deleted alongside it is
   * gone. Never empty.
   */
  readonly survivingNotePaths: readonly string[];
}

interface DeleteIfNotUsedParams {
  readonly app: App;
  deleteAbstractFile?(this: void, file: TAbstractFile): Promise<void>;
  readonly deletedNotePath?: string;
  readonly deletedNotePaths?: readonly string[];
  readonly pathOrFile: PathOrAbstractFile;
  readonly pluginNoticeComponent?: PluginNoticeComponent;
  rescueStillUsedFile?(this: void, params: RescueStillUsedFileParams): Promise<boolean>;
  readonly shouldDeleteEmptyFolders?: boolean;
  shouldProtectIfStillUsed?(this: void, file: TFile): boolean;
}

/**
 * Deletes an abstract file safely from the vault, but only if it is not referenced by other notes.
 *
 * Backlinks originating from {@link DeleteIfNotUsedParams.deletedNotePath} and
 * {@link DeleteIfNotUsedParams.deletedNotePaths} are discounted before deciding whether a file is still
 * used — a note that is itself going away cannot keep an attachment alive. Deleting a single note needs
 * only the former; deleting a folder needs the latter, because every note inside it disappears at once.
 *
 * {@link DeleteIfNotUsedParams.shouldProtectIfStillUsed} narrows which files that protection covers; a file
 * it rejects is deleted no matter how many notes link to it. Deleting a whole folder of notes uses this to
 * exempt the notes themselves — leaving a dangling link behind is what Obsidian normally does, so keeping
 * every linked-to note would make folder deletion impossible. By default every still-used file is kept.
 *
 * A kept file is stranded: it survives in a folder whose owning note is gone, while the note still
 * referencing it lives elsewhere. {@link DeleteIfNotUsedParams.rescueStillUsedFile} is the seam that lets
 * the caller relocate it instead, since where it belongs is the caller's attachment-path policy, not this
 * function's. Without that callback the file is simply kept, exactly as before.
 *
 * The actual removal goes through {@link DeleteIfNotUsedParams.deleteAbstractFile} when supplied,
 * otherwise through {@link trashSafe}. A caller that intercepted a specific deletion primitive passes its
 * unpatched original here, so the user's chosen semantics (permanent delete vs trash) survive the detour.
 *
 * @param params - The parameters for the function.
 * @returns A {@link Promise} that resolves to {@link DeleteIfNotUsedResult.Deleted} if the abstract file
 * was deleted, {@link DeleteIfNotUsedResult.Rescued} if it was moved away by
 * {@link DeleteIfNotUsedParams.rescueStillUsedFile}, or {@link DeleteIfNotUsedResult.NotDeleted} if it was
 * kept where it was.
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
    const survivingNotePaths = await getSurvivingNotePaths(params, file);
    if (survivingNotePaths.length > 0) {
      if (await params.rescueStillUsedFile?.({ file, survivingNotePaths })) {
        return DeleteIfNotUsedResult.Rescued;
      }

      params.pluginNoticeComponent?.showNotice(t(($) => $.obsidianDevUtils.notices.attachmentIsStillUsed, { attachmentPath: file.path }));
      canDelete = false;
    }
    /* v8 ignore start -- TAbstractFile is always TFile or TFolder in Obsidian; defensive fallback. */
  } else if (isFolder(file)) {
    /* v8 ignore stop */
    const listedFiles = await listSafe(params.app, file);
    for (const child of [...listedFiles.files, ...listedFiles.folders]) {
      canDelete &&= isGoneFromParent(
        await deleteIfNotUsed(normalizeOptionalProperties<DeleteIfNotUsedParams>({
          app: params.app,
          deleteAbstractFile: params.deleteAbstractFile,
          deletedNotePath: params.deletedNotePath,
          deletedNotePaths: params.deletedNotePaths,
          pathOrFile: child,
          pluginNoticeComponent: params.pluginNoticeComponent,
          rescueStillUsedFile: params.rescueStillUsedFile,
          shouldDeleteEmptyFolders: params.shouldDeleteEmptyFolders,
          shouldProtectIfStillUsed: params.shouldProtectIfStillUsed
        }))
      );
    }

    canDelete &&= await isEmptyFolder(params.app, file);
  }

  if (canDelete) {
    try {
      if (params.deleteAbstractFile) {
        await params.deleteAbstractFile(file);
      } else {
        await trashSafe(params.app, file);
      }
    } catch (error) {
      printError(new Error(`Failed to delete ${file.path}`, { cause: error }));
      canDelete = false;
    }
  }

  return canDelete ? DeleteIfNotUsedResult.Deleted : DeleteIfNotUsedResult.NotDeleted;
}

/**
 * Lists the notes that would still reference a file once everything being deleted alongside it is gone.
 *
 * @param params - The parameters {@link deleteIfNotUsed} was called with.
 * @param file - The file whose remaining references are counted.
 * @returns A {@link Promise} that resolves to the paths of the notes that keep the file alive. Empty means
 * the file is free to go.
 */
async function getSurvivingNotePaths(params: DeleteIfNotUsedParams, file: TFile): Promise<readonly string[]> {
  if (!(params.shouldProtectIfStillUsed?.(file) ?? true)) {
    return [];
  }

  const backlinks = await getBacklinksForFileSafe({ app: params.app, pathOrFile: file });
  const deletedNotePaths = new Set(params.deletedNotePaths);
  if (params.deletedNotePath) {
    deletedNotePaths.add(params.deletedNotePath);
  }
  for (const deletedNotePath of deletedNotePaths) {
    backlinks.clear(deletedNotePath);
  }

  return backlinks.keys();
}

/**
 * Checks whether a child no longer sits in the folder being walked — deleted outright, or moved elsewhere
 * by a rescue. Either way the folder holding it can still be removed; only a child kept in place blocks it.
 *
 * @param result - The result of deleting the child.
 * @returns `true` when the child is gone from its parent folder.
 */
function isGoneFromParent(result: DeleteIfNotUsedResult): boolean {
  return result === DeleteIfNotUsedResult.Deleted || result === DeleteIfNotUsedResult.Rescued;
}
