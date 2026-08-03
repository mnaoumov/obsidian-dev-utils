/**
 * @file
 *
 * Provides utility functions for working with attachment paths.
 */

import type {
  App,
  FileStats,
  Vault
} from 'obsidian';

import {
  getDataAdapterEx,
  parentFolderPath
} from '@obsidian-typings/obsidian-public-latest/implementations';

import type { PathOrFile } from './file-system.ts';

import {
  basename,
  dirname,
  extname,
  join,
  makeFileName
} from '../path.ts';
import {
  normalizeString,
  replaceAll,
  trimStart
} from '../string.ts';
import {
  getFile,
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
export interface GetAvailablePathForAttachmentsExtendedFunctionParams {
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
export interface GetAvailablePathForAttachmentsFunctionExtended extends GetAvailablePathForAttachmentsFunction {
  /**
   * Get available path for attachments with additional params.
   *
   * @param params - Parameters for the get available path for attachments.
   * @returns A {@link Promise} that resolves to the available path for attachments.
   */
  extended(params: GetAvailablePathForAttachmentsExtendedFunctionParams): Promise<string>;
}

type GetAvailablePathForAttachmentsFunction = Vault['getAvailablePathForAttachments'];

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
 * Parameters for {@link getAttachmentFolderPath}.
 */
export interface GetAttachmentFolderPathParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The context.
   *
   * @default {@link AttachmentPathContext.Unknown}
   */
  readonly context?: AttachmentPathContext;

  /**
   * The path of the note.
   */
  readonly notePathOrFile: PathOrFile;
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
   *
   * @default `false`
   */
  readonly shouldSkipDuplicateCheck?: boolean;
  /**
   * Should missing attachment folder creation be skipped.
   *
   * @default `false`
   */
  readonly shouldSkipMissingAttachmentFolderCreation?: boolean;
}

/**
 * Parameters for {@link hasOwnAttachmentFolder}.
 */
export interface HasOwnAttachmentFolderParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The context.
   *
   * @default {@link AttachmentPathContext.Unknown}
   */
  readonly context?: AttachmentPathContext;

  /**
   * The path of the note.
   */
  readonly path: string;
}

/**
 * Parameters for {@link isAtProperAttachmentPath}.
 */
export interface IsAtProperAttachmentPathParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The path or file of the attachment to check.
   */
  readonly attachmentPathOrFile: PathOrFile;

  /**
   * The context.
   *
   * @default {@link AttachmentPathContext.Unknown}
   */
  readonly context?: AttachmentPathContext;

  /**
   * The path or file of the note that references the attachment.
   */
  readonly notePathOrFile: PathOrFile;
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

  const extendedFunction = (app.vault.getAvailablePathForAttachments as Partial<GetAvailablePathForAttachmentsFunctionExtended>).extended;
  if (extendedFunction) {
    return extendedFunction({
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
 * @param params - Parameters for the get attachment folder path function.
 * @returns A {@link Promise} that resolves to the attachment folder path.
 */
export async function getAttachmentFolderPath(params: GetAttachmentFolderPathParams): Promise<string> {
  const {
    app,
    context = AttachmentPathContext.Unknown,
    notePathOrFile
  } = params;
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
      $string: attachmentFolderPath,
      prefix: './'
    })
    : null;

  // A note that does not exist yet (a rename target, a dummy sibling) still belongs to its own folder.
  // Materializing it from its path keeps that folder, where a vault lookup would fall back to the root.
  // Only an explicitly note-less attachment resolves to the vault root.
  const noteFileOrNull = notePathOrFile === null
    ? null
    : getFile({
      app,
      pathOrFile: notePathOrFile,
      shouldIncludeNonExisting: true
    });

  if (isCurrentFolder) {
    attachmentFolderPath = noteFileOrNull ? noteFileOrNull.parent?.path ?? '' : '';
  } else if (relativePath) {
    attachmentFolderPath = (noteFileOrNull ? noteFileOrNull.parent?.getParentPrefix() ?? '' : '') + relativePath;
  }

  attachmentFolderPath = normalizeString(normalizeSlashes(attachmentFolderPath));
  const attachmentFileBaseName = normalizeString(normalizeSlashes(params.attachmentFileBaseName));

  let folder = getFolderOrNull({ app, isCaseInsensitive: true, pathOrFolder: attachmentFolderPath });

  if (!folder && relativePath && !shouldSkipMissingAttachmentFolderCreation) {
    folder = await app.vault.createFolder(attachmentFolderPath);
  }

  // A folder that does not exist yet still owns the attachment path.
  // Resolving it as a non-existing folder stops the answer from collapsing to the vault root.
  folder ??= getFolder({ app, pathOrFolder: attachmentFolderPath, shouldIncludeNonExisting: true });

  const prefix = folder.getParentPrefix();
  return shouldSkipDuplicateCheck
    ? makeFileName({
      fileBaseName: prefix + attachmentFileBaseName,
      fileExtension: attachmentFileExtension
    })
    : app.vault.getAvailablePath(prefix + attachmentFileBaseName, attachmentFileExtension);
}

/**
 * Checks whether a note's attachment folder is specific to that note rather than shared with its siblings.
 *
 * The answer is derived by comparing the note's attachment folder with the one a same-folder sibling note
 * would get: they differ only when the folder depends on the note's NAME. Every built-in
 * `attachmentFolderPath` mode — the vault root, a fixed folder, the note's own folder (`./`), a subfolder of
 * the note's folder (`./sub`) — is shared by every note in that folder, so it answers `false`; `true` arises
 * from a {@link GetAvailablePathForAttachmentsFunctionExtended.extended} override that derives the folder from the
 * note's name (what an attachment-location plugin produces).
 *
 * This is the distinction a caller needs before sweeping an attachment folder wholesale: only a
 * note-specific folder can be treated as belonging to the note.
 *
 * @param params - Parameters for the has own attachment folder function.
 * @returns A {@link Promise} that resolves to a boolean indicating whether the note has its own attachment folder.
 */
export async function hasOwnAttachmentFolder(params: HasOwnAttachmentFolderParams): Promise<boolean> {
  const {
    app,
    context = AttachmentPathContext.Unknown,
    path
  } = params;
  const attachmentFolderPath = await getAttachmentFolderPath({
    app,
    context,
    notePathOrFile: path
  });
  const dummyAttachmentFolderPath = await getAttachmentFolderPath({
    app,
    context,
    notePathOrFile: join(dirname(path), `${DUMMY_PATH}.${MARKDOWN_FILE_EXTENSION}`)
  });
  return attachmentFolderPath !== dummyAttachmentFolderPath;
}

/**
 * Checks whether an attachment already sits at its proper attachment path.
 *
 * Returns `true` when the attachment's current path is, within its proper attachment folder, either the proper
 * base name or the proper base name plus an Obsidian deduplication suffix (a space followed by digits, e.g.
 * `img 1`) with the same extension. The proper path is computed via {@link getAttachmentFilePath} with
 * {@link GetAttachmentFilePathParams.shouldSkipDuplicateCheck} set to `true` (the target before any
 * deduplication suffix), and the comparison respects the file system case-sensitivity flag
 * (`getDataAdapterEx(app).insensitive`) that `getSafeRenamePath` uses.
 *
 * This lets a caller recognize a deduplication-parked attachment as already-collected, so a "needs move?"
 * decision made against the deduplication-free proper path converges instead of re-scheduling the file forever.
 *
 * @param params - Parameters for the is at proper attachment path function.
 * @returns A {@link Promise} that resolves to `true` when the attachment is already at its proper path.
 */
export async function isAtProperAttachmentPath(params: IsAtProperAttachmentPathParams): Promise<boolean> {
  const {
    app,
    attachmentPathOrFile,
    context = AttachmentPathContext.Unknown,
    notePathOrFile
  } = params;

  const currentPath = getPath(app, attachmentPathOrFile);
  const properPath = await getAttachmentFilePath({
    app,
    context,
    notePathOrFile,
    oldAttachmentPathOrFile: attachmentPathOrFile,
    shouldSkipDuplicateCheck: true
  });

  const isInsensitive = getDataAdapterEx(app).insensitive;

  function fold(value: string): string {
    return isInsensitive ? value.toLowerCase() : value;
  }

  if (fold(dirname(currentPath)) !== fold(dirname(properPath))) {
    return false;
  }

  const currentExtension = extname(currentPath);
  const properExtension = extname(properPath);
  if (fold(currentExtension) !== fold(properExtension)) {
    return false;
  }

  const currentBaseName = basename(currentPath, currentExtension);
  const properBaseName = basename(properPath, properExtension);

  if (fold(currentBaseName) === fold(properBaseName)) {
    return true;
  }

  const deduplicationPrefix = `${properBaseName} `;
  if (!fold(currentBaseName).startsWith(fold(deduplicationPrefix))) {
    return false;
  }

  const deduplicationSuffix = currentBaseName.slice(deduplicationPrefix.length);
  return /^\d+$/.test(deduplicationSuffix);
}

/**
 * Normalizes a path by combining multiple slashes into a single slash and removing leading and trailing slashes.
 *
 * @param path - Path to normalize.
 * @returns The normalized path.
 */
function normalizeSlashes(path: string): string {
  path = replaceAll({
    $string: path,
    replacer: '/',
    searchValue: /(?:[\\/])+/g
  });
  path = replaceAll({
    $string: path,
    replacer: '',
    searchValue: /^\/+|\/+$/g
  });
  return path || '/';
}
