/**
 * @file
 *
 * Provides utility functions for working with attachment paths.
 */

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */

import type {
  App,
  FileStats,
  Vault
} from 'obsidian';

import { parentFolderPath } from '@obsidian-typings/obsidian-public-latest/implementations';

import type { PathOrFile } from './file-system.ts';

import {
  basename,
  dirname,
  extname,
  join,
  makeFileName
} from '../path.ts';
import {
  normalize,
  replaceAll,
  trimStart
} from '../string.ts';
import {
  getFileOrNull,
  getFolder,
  getFolderOrNull,
  getPath,
  MARKDOWN_FILE_EXTENSION
} from './file-system.ts';

/**
 * A context for an attachment path.
 */
export enum AttachmentPathContext {
  /**
   * A context for a delete note.
   */
  DeleteNote = 'DeleteNote',

  /**
   * A context for a rename note.
   */
  RenameNote = 'RenameNote',

  /**
   * An unknown context.
   */
  Unknown = 'Unknown'
}

/**
 * Options for the get available path for attachments extended function.
 */
export interface GetAvailablePathForAttachmentsExtendedFnParams {
  /**
   * A base name of the attachment.
   */
  readonly attachmentFileBaseName: string;

  /**
   * An extension of the attachment.
   */
  readonly attachmentFileExtension: string;

  /**
   * A stats of the attachment file.
   */
  readonly attachmentFileStats?: FileStats | undefined;

  /**
   * A context.
   */
  readonly context: AttachmentPathContext;

  /**
   * A path or file of the note.
   */
  readonly notePathOrFile: null | PathOrFile;

  /**
   * A path or file of the old attachment.
   */
  readonly oldAttachmentPathOrFile: PathOrFile;

  /**
   * A path or file of the old note.
   */
  readonly oldNotePathOrFile?: PathOrFile | undefined;

  /**
   * Lazily reads the content of the attachment file.
   *
   * The content is read on demand only when a consumer actually needs the bytes (e.g. a template
   * token that embeds them). For the default templates nothing pulls the bytes, so the potentially
   * expensive (size-proportional) `readBinary` never runs. Consumers that may call this more than
   * once should memoize the first call. `null` when there is no attachment file to read.
   *
   * @returns A {@link Promise} that resolves to the content of the attachment file.
   */
  readonly readAttachmentFileContent: (() => Promise<ArrayBuffer>) | null;

  /**
   * Should the duplicate check be skipped.
   */
  readonly shouldSkipDuplicateCheck?: boolean;

  /**
   * Should the generated attachment file name be skipped.
   */
  readonly shouldSkipGeneratedAttachmentFileName?: boolean;

  /**
   * Should missing attachment folder creation be skipped.
   */
  readonly shouldSkipMissingAttachmentFolderCreation: boolean | undefined;
}

/**
 * {@link Vault.getAvailablePathForAttachments} extended wrapper.
 */
export interface GetAvailablePathForAttachmentsFnExtended extends GetAvailablePathForAttachmentsFn {
  /**
   * Get available path for attachments with additional params.
   *
   * @param params - Parameters for the get available path for attachments.
   * @returns A {@link Promise} that resolves to the available path for attachments.
   */
  extended(params: GetAvailablePathForAttachmentsExtendedFnParams): Promise<string>;
}

type GetAvailablePathForAttachmentsFn = Vault['getAvailablePathForAttachments'];

/**
 * Dummy path.
 */
export const DUMMY_PATH = '__DUMMY__';

/**
 * Options for the getAttachmentFilePath function.
 */
export interface GetAttachmentFilePathParams {
  /**
   * An Obsidian application instance.
   */
  readonly app: App;

  /**
   * A context.
   */
  readonly context: AttachmentPathContext;

  /**
   * A path of the note.
   */
  readonly notePathOrFile: PathOrFile;

  /**
   * A path of the attachment.
   */
  readonly oldAttachmentPathOrFile: PathOrFile;

  /**
   * A path of the old note.
   */
  readonly oldNotePathOrFile?: PathOrFile | undefined;

  /**
   * Should the duplicate check be skipped.
   */
  readonly shouldSkipDuplicateCheck: boolean;
}

/**
 * Options for the getAvailablePathForAttachments function.
 */
export interface GetAvailablePathForAttachmentsParams {
  /**
   * An Obsidian application instance.
   */
  readonly app: App;
  /**
   * A base name of the attachment.
   */
  readonly attachmentFileBaseName: string;
  /**
   * An extension of the attachment.
   */
  readonly attachmentFileExtension: string;
  /**
   * A file to attach to.
   */
  readonly notePathOrFile: null | PathOrFile;
  /**
   * Should the duplicate check be skipped.
   */
  readonly shouldSkipDuplicateCheck?: boolean;
  /**
   * Should missing attachment folder creation be skipped.
   */
  readonly shouldSkipMissingAttachmentFolderCreation?: boolean;
}

/**
 * Retrieves the file path for an attachment within a note.
 *
 * @param params - Parameters for the get attachment file path function.
 * @returns A {@link Promise} that resolves to the file path of the attachment.
 */
export async function getAttachmentFilePath(params: GetAttachmentFilePathParams): Promise<string> {
  const {
    app,
    notePathOrFile,
    oldAttachmentPathOrFile,
    shouldSkipDuplicateCheck
  } = params;
  const attachmentPath = getPath(app, oldAttachmentPathOrFile);
  const attachmentFileExtension = extname(attachmentPath);
  const attachmentFileBaseName = basename(attachmentPath, attachmentFileExtension);
  const attachmentFile = getFileOrNull({ app, pathOrFile: attachmentPath });

  const extendedFn = (app.vault.getAvailablePathForAttachments as Partial<GetAvailablePathForAttachmentsFnExtended>).extended;
  if (extendedFn) {
    return extendedFn({
      attachmentFileBaseName,
      attachmentFileExtension: attachmentFileExtension.slice(1),
      attachmentFileStats: attachmentFile?.stat,
      context: params.context,
      notePathOrFile,
      oldAttachmentPathOrFile: params.oldAttachmentPathOrFile,
      oldNotePathOrFile: params.oldNotePathOrFile,
      readAttachmentFileContent: attachmentFile ? (): Promise<ArrayBuffer> => app.vault.readBinary(attachmentFile) : null,
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
export async function getAttachmentFolderPath(app: App, notePathOrFile: PathOrFile, context = AttachmentPathContext.Unknown): Promise<string> {
  return parentFolderPath(
    await getAttachmentFilePath({
      app,
      context,
      notePathOrFile,
      oldAttachmentPathOrFile: DUMMY_PATH,
      shouldSkipDuplicateCheck: true
    })
  );
}

/**
 * Retrieves the available path for attachments.
 *
 * @param params - Parameters for the get available path for attachments function.
 * @returns A {@link Promise} that resolves to the available path for attachments.
 */
export async function getAvailablePathForAttachments(params: GetAvailablePathForAttachmentsParams): Promise<string> {
  const {
    app,
    attachmentFileExtension,
    notePathOrFile,
    shouldSkipDuplicateCheck,
    shouldSkipMissingAttachmentFolderCreation
  } = params;
  let attachmentFolderPath = app.vault.getConfig('attachmentFolderPath') as string;
  const isCurrentFolder = attachmentFolderPath === '.' || attachmentFolderPath === './';
  const relativePath = attachmentFolderPath.startsWith('./')
    ? trimStart({
      prefix: './',
      str: attachmentFolderPath
    })
    : null;

  const noteFileOrNull = getFileOrNull({ app, pathOrFile: notePathOrFile });

  if (isCurrentFolder) {
    attachmentFolderPath = noteFileOrNull ? noteFileOrNull.parent?.path ?? '' : '';
  } else if (relativePath) {
    attachmentFolderPath = (noteFileOrNull ? noteFileOrNull.parent?.getParentPrefix() ?? '' : '') + relativePath;
  }

  attachmentFolderPath = normalize(normalizeSlashes(attachmentFolderPath));
  const attachmentFileBaseName = normalize(normalizeSlashes(params.attachmentFileBaseName));

  let folder = getFolderOrNull({ app, isCaseInsensitive: true, pathOrFolder: attachmentFolderPath });

  if (!folder && relativePath) {
    folder = shouldSkipMissingAttachmentFolderCreation
      ? getFolder({ app, pathOrFolder: attachmentFolderPath, shouldIncludeNonExisting: true })
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
export async function hasOwnAttachmentFolder(app: App, path: string, context = AttachmentPathContext.Unknown): Promise<boolean> {
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
  path = replaceAll({
    replacer: '/',
    searchValue: /(?:[\\/])+/g,
    str: path
  });
  path = replaceAll({
    replacer: '',
    searchValue: /^\/+|\/+$/g,
    str: path
  });
  return path || '/';
}

/* v8 ignore stop */
