/**
 * @file
 *
 * Resolves which folder an attachment belongs to when the user has designated folders that must
 * travel as a single unit.
 *
 * Some formats are really a directory tree rather than a file: a page saved from a browser sits next
 * to a `_files/` folder holding its images and stylesheets, an `.excalidraw` sits next to the images
 * it references. Relocating only the linked file leaves the rest behind and the attachment arrives
 * broken.
 *
 * This lives in the shared library rather than in one plugin because more than one plugin relocates
 * attachments over the same vault. If they each decided separately what one attachment is, a user
 * with both installed would get a folder kept whole by one and torn apart by the other.
 *
 * Which is why the designation itself is read from the vault rather than supplied per caller: pass an
 * {@link App} and {@link findAttachmentUnitFolderPath} walks with whatever an attachment-location
 * plugin published on the patched `Vault.getAvailablePathForAttachments`, so every plugin decides from
 * one answer. The explicit-predicate form remains for a caller that genuinely owns its own patterns.
 */

import type { App } from 'obsidian';

import { dirname } from '../path.ts';
import { getCheckIsAttachmentUnitFolderFunction } from './attachment-path.ts';

/**
 * Parameters for {@link findAttachmentUnitFolderPath}, reading the designation published on the vault.
 */
export interface FindAttachmentUnitFolderPathFromAppParams {
  /**
   * An Obsidian application instance, whose patched `Vault.getAvailablePathForAttachments` carries the
   * designation.
   */
  readonly app: App;

  /**
   * The vault-relative path of the attachment.
   */
  readonly attachmentPath: string;
}

/**
 * Parameters for {@link findAttachmentUnitFolderPath}.
 *
 * Prefer {@link FindAttachmentUnitFolderPathFromAppParams} — it is the form that makes every plugin
 * decide from one published answer.
 */
export type FindAttachmentUnitFolderPathParams = FindAttachmentUnitFolderPathFromAppParams | FindAttachmentUnitFolderPathWithPredicateParams;

/**
 * Parameters for {@link findAttachmentUnitFolderPath}, walking with a predicate the caller owns.
 */
export interface FindAttachmentUnitFolderPathWithPredicateParams {
  /**
   * The vault-relative path of the attachment.
   */
  readonly attachmentPath: string;

  /**
   * Whether a folder path is designated as an attachment unit.
   *
   * @param folderPath - The vault-relative path of the folder.
   * @returns `true` if the folder is designated as an attachment unit, `false` otherwise.
   */
  checkIsAttachmentUnitFolder(this: void, folderPath: string): boolean;
}

/**
 * Parameters for {@link rebasePathOntoFolder}.
 */
export interface RebasePathOntoFolderParams {
  /**
   * The folder's new path.
   */
  readonly newFolderPath: string;

  /**
   * The folder's old path.
   */
  readonly oldFolderPath: string;

  /**
   * The path to rebase.
   */
  readonly path: string;
}

/**
 * Finds the folder that an attachment must travel with.
 *
 * Returns the **outermost** designated ancestor, not the nearest one. With nested designations,
 * moving the nearest would tear the outer tree in half, which is the failure the whole feature exists
 * to prevent.
 *
 * The vault root is never a unit, however the patterns are written: designating it would make every
 * relocation a no-op at best and a vault-wide move at worst.
 *
 * Passing an {@link App} walks with the designation an attachment-location plugin published on the vault;
 * when nobody published one, nothing is designated and the answer is `null`.
 *
 * @param params - The parameters for finding the attachment unit folder.
 * @returns The unit folder's path, or `null` when the attachment belongs to no unit.
 */
export function findAttachmentUnitFolderPath(params: FindAttachmentUnitFolderPathParams): null | string {
  const parentFolderPath = dirname(params.attachmentPath);
  if (!parentFolderPath || parentFolderPath === '.' || parentFolderPath === '/') {
    return null;
  }

  const checkIsAttachmentUnitFolder = 'checkIsAttachmentUnitFolder' in params
    ? params.checkIsAttachmentUnitFolder
    : getCheckIsAttachmentUnitFolderFunction(params.app);

  if (!checkIsAttachmentUnitFolder) {
    return null;
  }

  const segments = parentFolderPath.split('/').filter(Boolean);
  for (let count = 1; count <= segments.length; count++) {
    const candidate = segments.slice(0, count).join('/');
    if (checkIsAttachmentUnitFolder(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Rebases a path from one folder onto another.
 *
 * Used to work out where a linked attachment ends up once its whole unit folder has moved, so the
 * link can be pointed at the file's new home rather than at where the folder used to be.
 *
 * @param params - The parameters for rebasing the path.
 * @returns The rebased path, or `null` when the path does not sit inside the old folder.
 */
export function rebasePathOntoFolder(params: RebasePathOntoFolderParams): null | string {
  const prefix = `${params.oldFolderPath}/`;
  if (!params.path.startsWith(prefix)) {
    return null;
  }

  return `${params.newFolderPath}/${params.path.slice(prefix.length)}`;
}
