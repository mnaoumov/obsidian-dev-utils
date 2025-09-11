/**
 * @packageDocumentation
 *
 * Provides utility functions for working with attachment paths.
 */

import type {
  App,
  FileStats,
  Vault
} from 'obsidian';

import { parentFolderPath } from 'obsidian-typings/implementations';

import type { PathOrFile } from './FileSystem.ts';

import {
  basename,
  dirname,
  extname,
  join,
  makeFileName
} from '../Path.ts';
import {
  normalize,
  replaceAll,
  trimStart
} from '../String.ts';
import {
  getFileOrNull,
  getFolder,
  getFolderOrNull,
  getPath,
  MARKDOWN_FILE_EXTENSION
} from './FileSystem.ts';

/**
 * Options for the get available path for attachments extended function.
 */
export interface GetAvailablePathForAttachmentsExtendedFnOptions {
  /**
   * A base name of the attachment.
   */
  attachmentFileBaseName: string;

  /**
   * A content of the attachment file.
   */
  attachmentFileContent?: ArrayBuffer | undefined;

  /**
   * An extension of the attachment.
   */
  attachmentFileExtension: string;

  /**
   * A stats of the attachment file.
   */
  attachmentFileStat?: FileStats | undefined;

  /**
   * A context.
   */
  context: string;

  /**
   * A path or file of the note.
   */
  notePathOrFile: null | PathOrFile;

  /**
   * Should the duplicate check be skipped.
   */
  shouldSkipDuplicateCheck?: boolean;

  /**
   * Should the generated attachment file name be skipped.
   */
  shouldSkipGeneratedAttachmentFileName?: boolean;

  /**
   * Should missing attachment folder creation be skipped.
   */
  shouldSkipMissingAttachmentFolderCreation: boolean | undefined;
}

/**
 * {@link Vault.getAvailablePathForAttachments} extended wrapper.
 */
export interface GetAvailablePathForAttachmentsFnExtended extends GetAvailablePathForAttachmentsFn {
  /**
   * Get available path for attachments with additional options.
   *
   * @param options - Options for the get available path for attachments.
   * @returns A {@link Promise} that resolves to the available path for attachments.
   */
  extended(options: GetAvailablePathForAttachmentsExtendedFnOptions): Promise<string>;
}

type GetAvailablePathForAttachmentsFn = Vault['getAvailablePathForAttachments'];

/**
 * The context for a delete note.
 */
export const ATTACHMENT_PATH_CONTEXT_DELETE_NOTE = 'DeleteNote';

/**
 * The context for a rename note.
 */
export const ATTACHMENT_PATH_CONTEXT_RENAME_NOTE = 'RenameNote';

/**
 * The context for an unknown action.
 */
export const ATTACHMENT_PATH_CONTEXT_UNKNOWN = 'Unknown';

/**
 * Dummy path.
 */
export const DUMMY_PATH = '__DUMMY__';

/**
 * Options for the getAttachmentFilePath function.
 */
export interface GetAttachmentFilePathOptions {
  /**
   * An Obsidian application instance.
   */
  app: App;
  /**
   * A path of the attachment.
   */
  attachmentPathOrFile: PathOrFile;

  /**
   * A context.
   */
  context: string;

  /**
   * A path of the note.
   */
  notePathOrFile: PathOrFile;
  /**
   * Should the duplicate check be skipped.
   */
  shouldSkipDuplicateCheck: boolean;
}

/**
 * Options for the getAvailablePathForAttachments function.
 */
export interface GetAvailablePathForAttachmentsOptions {
  /**
   * An Obsidian application instance.
   */
  app: App;
  /**
   * A base name of the attachment.
   */
  attachmentFileBaseName: string;
  /**
   * An extension of the attachment.
   */
  attachmentFileExtension: string;
  /**
   * A file to attach to.
   */
  notePathOrFile: null | PathOrFile;
  /**
   * Should the duplicate check be skipped.
   */
  shouldSkipDuplicateCheck?: boolean;
  /**
   * Should missing attachment folder creation be skipped.
   */
  shouldSkipMissingAttachmentFolderCreation?: boolean;
}

/**
 * Retrieves the file path for an attachment within a note.
 *
 * @param options - Options for the get attachment file path function.
 * @returns A {@link Promise} that resolves to the file path of the attachment.
 */
export async function getAttachmentFilePath(options: GetAttachmentFilePathOptions): Promise<string> {
  const {
    app,
    attachmentPathOrFile,
    notePathOrFile,
    shouldSkipDuplicateCheck
  } = options;
  const attachmentPath = getPath(app, attachmentPathOrFile);
  const attachmentFileExtension = extname(attachmentPath);
  const attachmentFileBaseName = basename(attachmentPath, attachmentFileExtension);
  const attachmentFile = getFileOrNull(app, attachmentPath);

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const internalFn = app.vault.getAvailablePathForAttachments;
  const extendedFn = (internalFn as Partial<GetAvailablePathForAttachmentsFnExtended>).extended;
  if (extendedFn) {
    return extendedFn({
      attachmentFileBaseName,
      attachmentFileContent: attachmentFile ? await app.vault.readBinary(attachmentFile) : undefined,
      attachmentFileExtension: attachmentFileExtension.slice(1),
      attachmentFileStat: attachmentFile?.stat,
      context: options.context,
      notePathOrFile,
      shouldSkipDuplicateCheck,
      shouldSkipMissingAttachmentFolderCreation: true
    });
  }

  return await getAvailablePathForAttachments({
    app,
    attachmentFileBaseName,
    attachmentFileExtension: attachmentFileExtension.slice(1),
    notePathOrFile,
    shouldSkipDuplicateCheck,
    shouldSkipMissingAttachmentFolderCreation: true
  });
}

/**
 * Retrieves the attachment folder path for a given note.
 *
 * @param app - The Obsidian application instance.
 * @param notePathOrFile - The path of the note.
 * @param context - The context.
 * @returns A {@link Promise} that resolves to the attachment folder path.
 */
export async function getAttachmentFolderPath(app: App, notePathOrFile: PathOrFile, context = ATTACHMENT_PATH_CONTEXT_UNKNOWN): Promise<string> {
  return parentFolderPath(
    await getAttachmentFilePath({
      app,
      attachmentPathOrFile: DUMMY_PATH,
      context,
      notePathOrFile,
      shouldSkipDuplicateCheck: true
    })
  );
}

/**
 * Retrieves the available path for attachments.
 *
 * @param options - Options for the get available path for attachments function.
 * @returns A {@link Promise} that resolves to the available path for attachments.
 */
export async function getAvailablePathForAttachments(options: GetAvailablePathForAttachmentsOptions): Promise<string> {
  const {
    app,
    attachmentFileExtension,
    notePathOrFile,
    shouldSkipDuplicateCheck,
    shouldSkipMissingAttachmentFolderCreation
  } = options;
  let attachmentFolderPath = app.vault.getConfig('attachmentFolderPath') as string;
  const isCurrentFolder = attachmentFolderPath === '.' || attachmentFolderPath === './';
  const relativePath = attachmentFolderPath.startsWith('./') ? trimStart(attachmentFolderPath, './') : null;

  const noteFileOrNull = getFileOrNull(app, notePathOrFile);

  if (isCurrentFolder) {
    attachmentFolderPath = noteFileOrNull ? noteFileOrNull.parent?.path ?? '' : '';
  } else if (relativePath) {
    attachmentFolderPath = (noteFileOrNull ? noteFileOrNull.parent?.getParentPrefix() ?? '' : '') + relativePath;
  }

  attachmentFolderPath = normalize(normalizeSlashes(attachmentFolderPath));
  const attachmentFileBaseName = normalize(normalizeSlashes(options.attachmentFileBaseName));

  let folder = getFolderOrNull(app, attachmentFolderPath, true);

  if (!folder && relativePath) {
    folder = shouldSkipMissingAttachmentFolderCreation
      ? getFolder(app, attachmentFolderPath, true)
      : await app.vault.createFolder(attachmentFolderPath);
  }

  const prefix = folder?.getParentPrefix() ?? '';
  return shouldSkipDuplicateCheck
    ? makeFileName(prefix + attachmentFileBaseName, attachmentFileExtension)
    : app.vault.getAvailablePath(prefix + attachmentFileBaseName, attachmentFileExtension);
}

/**
 * Checks if a note has its own attachment folder.
 *
 * @param app - The Obsidian application instance.
 * @param path - The path of the note.
 * @param context - The context.
 * @returns A {@link Promise} that resolves to a boolean indicating whether the note has its own attachment folder.
 */
export async function hasOwnAttachmentFolder(app: App, path: string, context = ATTACHMENT_PATH_CONTEXT_UNKNOWN): Promise<boolean> {
  const attachmentFolderPath = await getAttachmentFolderPath(app, path, context);
  const dummyAttachmentFolderPath = await getAttachmentFolderPath(app, join(dirname(path), `${DUMMY_PATH}.${MARKDOWN_FILE_EXTENSION}`), context);
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
