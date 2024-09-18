/**
 * @packageDocumentation AttachmentPath
 * Provides utility functions for working with attachment paths.
 */

import type {
  App,
  TFile
} from 'obsidian';
import {
  createTFileInstance,
  createTFolderInstance,
  parentFolderPath
} from 'obsidian-typings/implementations';

import {
  basename,
  extname
} from '../Path.ts';
import {
  normalize,
  trimStart
} from '../String.ts';
import type { PathOrFile } from './FileSystem.ts';
import {
  getFolderOrNull,
  getPath
} from './FileSystem.ts';

/**
 * Retrieves the attachment folder path for a given note.
 *
 * @param app - The Obsidian application instance.
 * @param notePathOrFile - The path of the note.
 * @returns A promise that resolves to the attachment folder path.
 */
export async function getAttachmentFolderPath(app: App, notePathOrFile: PathOrFile): Promise<string> {
  return parentFolderPath(await getAttachmentFilePath(app, 'DUMMY_FILE.pdf', notePathOrFile));
}

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
export type GetAvailablePathForAttachmentsExtendedFn = (filename: string, extension: string, file: TFile | null, skipFolderCreation?: boolean) => Promise<string>;

/**
 * Retrieves the file path for an attachment within a note.
 *
 * @param app - The Obsidian application instance.
 * @param attachmentPathOrFile - The path of the attachment.
 * @param notePathOrFile - The path of the note.
 * @returns A promise that resolves to the file path of the attachment.
 */
export async function getAttachmentFilePath(app: App, attachmentPathOrFile: PathOrFile, notePathOrFile: PathOrFile): Promise<string> {
  const attachmentPath = getPath(attachmentPathOrFile);
  const notePath = getPath(notePathOrFile);
  const note = createTFileInstance(app.vault, notePath);
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
 * Retrieves the available path for attachments.
 * @param app - The Obsidian application instance.
 * @param filename - Name of the file.
 * @param extension - Extension of the file.
 * @param file - The file to attach to.
 * @param skipFolderCreation - Should folder creation be skipped?
 * @returns A promise that resolves to the available path for attachments.
 */
export async function getAvailablePathForAttachments(app: App, filename: string, extension: string, file: TFile | null, skipFolderCreation: boolean): Promise<string> {
  let attachmentFolderPath = app.vault.getConfig('attachmentFolderPath') as string;
  const isCurrentFolder = attachmentFolderPath === '.' || attachmentFolderPath === './';
  let relativePath = null;

  if (attachmentFolderPath.startsWith('./')) {
    relativePath = trimStart(attachmentFolderPath, './');
  }

  if (isCurrentFolder) {
    attachmentFolderPath = file ? file.parent?.path ?? '' : '';
  } else if (relativePath) {
    attachmentFolderPath = (file ? file.parent?.getParentPrefix() ?? '' : '') + relativePath;
  }

  attachmentFolderPath = normalize(normalizeSlashes(attachmentFolderPath));
  filename = normalize(normalizeSlashes(filename));

  let folder = getFolderOrNull(app, attachmentFolderPath, true);

  if (!folder && relativePath) {
    if (!skipFolderCreation) {
      folder = await app.vault.createFolder(attachmentFolderPath);
    } else {
      folder = createTFolderInstance(app.vault, attachmentFolderPath);
    }
  }

  const prefix = folder?.getParentPrefix() ?? '';
  return app.vault.getAvailablePath(prefix + filename, extension);
}

/**
 * Normalizes a path by combining multiple slashes into a single slash and removing leading and trailing slashes.
 * @param path - Path to normalize.
 * @returns The normalized path.
 */
function normalizeSlashes(path: string): string {
  path = path.replace(/([\\/])+/g, '/');
  path = path.replace(/(^\/+|\/+$)/g, '');
  return path || '/';
}
