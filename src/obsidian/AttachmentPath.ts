/**
 * @packageDocumentation
 *
 * Provides utility functions for working with attachment paths.
 */

import type {
  App,
  TFile
} from 'obsidian';

import { parentFolderPath } from 'obsidian-typings/implementations';

import type { PathOrFile } from './FileSystem.ts';

import {
  basename,
  dirname,
  extname,
  join
} from '../Path.ts';
import {
  normalize,
  replaceAll,
  trimStart
} from '../String.ts';
import {
  getFile,
  getFolder,
  getFolderOrNull,
  getPath
} from './FileSystem.ts';

/**
 * Is overridden wrapper.
 */
export interface ExtendedWrapper {
  /**
   * Is extended.
   */
  isExtended: true;
}

/**
 * Get available path for attachments function.
 */
export type GetAvailablePathForAttachmentsExtendedFn = (
  attachmentFileName: string,
  attachmentExtension: string,
  noteFile: null | TFile,
  shouldSkipMissingAttachmentFolderCreation?: boolean
) => Promise<string>;

/**
 * Dummy path.
 */
export const DUMMY_PATH = '__DUMMY__';

/**
 * Retrieves the file path for an attachment within a note.
 *
 * @param app - The Obsidian application instance.
 * @param attachmentPathOrFile - The path of the attachment.
 * @param notePathOrFile - The path of the note.
 * @returns A {@link Promise} that resolves to the file path of the attachment.
 */
export async function getAttachmentFilePath(app: App, attachmentPathOrFile: PathOrFile, notePathOrFile: PathOrFile): Promise<string> {
  const attachmentPath = getPath(app, attachmentPathOrFile);
  const notePath = getPath(app, notePathOrFile);
  const note = getFile(app, notePath, true);
  const ext = extname(attachmentPath);
  const fileName = basename(attachmentPath, ext);

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const internalFn = app.vault.getAvailablePathForAttachments;
  if ((internalFn as Partial<ExtendedWrapper>).isExtended) {
    return (internalFn as GetAvailablePathForAttachmentsExtendedFn)(fileName, ext.slice(1), note, true);
  }

  return await getAvailablePathForAttachments(app, fileName, ext.slice(1), note, true);
}

/**
 * Retrieves the attachment folder path for a given note.
 *
 * @param app - The Obsidian application instance.
 * @param notePathOrFile - The path of the note.
 * @returns A {@link Promise} that resolves to the attachment folder path.
 */
export async function getAttachmentFolderPath(app: App, notePathOrFile: PathOrFile): Promise<string> {
  return parentFolderPath(await getAttachmentFilePath(app, DUMMY_PATH, notePathOrFile));
}

/**
 * Retrieves the available path for attachments.
 *
 * @param app - The Obsidian application instance.
 * @param attachmentFileName - File name of the attachment.
 * @param attachmentExtension - Extension of the attachment.
 * @param noteFile - The file to attach to.
 * @param shouldSkipMissingAttachmentFolderCreation - Should missing attachment folder creation be skipped?
 * @returns A {@link Promise} that resolves to the available path for attachments.
 */
export async function getAvailablePathForAttachments(
  app: App,
  attachmentFileName: string,
  attachmentExtension: string,
  noteFile: null | TFile,
  shouldSkipMissingAttachmentFolderCreation: boolean
): Promise<string> {
  let attachmentFolderPath = app.vault.getConfig('attachmentFolderPath') as string;
  const isCurrentFolder = attachmentFolderPath === '.' || attachmentFolderPath === './';
  let relativePath = null;

  if (attachmentFolderPath.startsWith('./')) {
    relativePath = trimStart(attachmentFolderPath, './');
  }

  if (isCurrentFolder) {
    attachmentFolderPath = noteFile ? noteFile.parent?.path ?? '' : '';
  } else if (relativePath) {
    attachmentFolderPath = (noteFile ? noteFile.parent?.getParentPrefix() ?? '' : '') + relativePath;
  }

  attachmentFolderPath = normalize(normalizeSlashes(attachmentFolderPath));
  attachmentFileName = normalize(normalizeSlashes(attachmentFileName));

  let folder = getFolderOrNull(app, attachmentFolderPath, true);

  if (!folder && relativePath) {
    if (shouldSkipMissingAttachmentFolderCreation) {
      folder = getFolder(app, attachmentFolderPath, true);
    } else {
      folder = await app.vault.createFolder(attachmentFolderPath);
    }
  }

  const prefix = folder?.getParentPrefix() ?? '';
  return app.vault.getAvailablePath(prefix + attachmentFileName, attachmentExtension);
}

/**
 * Checks if a note has its own attachment folder.
 *
 * @param app - The Obsidian application instance.
 * @param path - The path of the note.
 * @returns A {@link Promise} that resolves to a boolean indicating whether the note has its own attachment folder.
 */
export async function hasOwnAttachmentFolder(app: App, path: string): Promise<boolean> {
  const attachmentFolderPath = await getAttachmentFolderPath(app, path);
  const dummyAttachmentFolderPath = await getAttachmentFolderPath(app, join(dirname(path), 'DUMMY_FILE.md'));
  return attachmentFolderPath !== dummyAttachmentFolderPath;
}

/**
 * Normalizes a path by combining multiple slashes into a single slash and removing leading and trailing slashes.
 *
 * @param path - Path to normalize.
 * @returns The normalized path.
 */
function normalizeSlashes(path: string): string {
  path = replaceAll(path, /(?:[\\/])+/g, '/');
  path = replaceAll(path, /^\/+|\/+$/g, '');
  return path || '/';
}
