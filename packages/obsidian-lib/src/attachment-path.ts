/**
 * @file
 *
 * Provides utility functions for working with attachment paths.
 */

import type {
  App,
  FileStats,
  TFolder
} from 'obsidian';

import {
  basename,
  dirname,
  extname,
  join,
  makeFileName
} from '@mnaoumov/typescript-lib/path';
import {
  normalizeString,
  replaceAll,
  trimStart
} from '@mnaoumov/typescript-lib/string';
import {
  getDataAdapterEx,
  parentFolderPath
} from '@obsidian-typings/obsidian-public-latest/implementations';

import type { PathOrFile } from './file-system.ts';
import type { PluginApiContract } from './plugin/plugin-api.ts';

import {
  getFile,
  getFileOrNull,
  getFolder,
  getFolderOrNull,
  getPath,
  MARKDOWN_FILE_EXTENSION
} from './file-system.ts';
import { findPluginApi } from './plugin/plugin-api.ts';

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
 * The slice of Custom Attachment Location's registry API this module calls, declared here rather than imported:
 * that plugin ships its surface as a hand-written `api.d.ts`, not as a package (see rule L9 in `AGENTS.md`).
 */
interface CustomAttachmentLocationAttachmentPathApi {
  /**
   * The plugin's full attachment-path resolver.
   *
   * @param params - The same fields as {@link GetAvailablePathForAttachmentsExtendedFunctionParams}, which the
   *   plugin declares field for field.
   * @returns A {@link Promise} that resolves to the attachment's path from the vault root.
   */
  getAvailablePathForAttachments: (params: GetAvailablePathForAttachmentsExtendedFunctionParams) => Promise<string>;

  /**
   * Whether the user designated a folder an attachment unit folder. Synchronous on purpose.
   *
   * @param params - The folder.
   * @returns Whether the folder is designated.
   */
  isAttachmentUnitFolder: (params: CustomAttachmentLocationIsAttachmentUnitFolderParams) => boolean;
}

/**
 * Parameters for {@link CustomAttachmentLocationAttachmentPathApi.isAttachmentUnitFolder}.
 */
interface CustomAttachmentLocationIsAttachmentUnitFolderParams {
  /**
   * The folder, as a vault-relative path.
   */
  readonly folderPath: string;
}

/**
 * The plugin id Custom Attachment Location publishes its API under.
 */
export const CUSTOM_ATTACHMENT_LOCATION_PLUGIN_ID = 'obsidian-custom-attachment-location';

/**
 * The contract versions of Custom Attachment Location's API this module compiled against. `1.3.0` is the first
 * to carry the two attachment-path methods.
 */
const CUSTOM_ATTACHMENT_LOCATION_ATTACHMENT_PATH_API_VERSION_RANGE = '^1.3.0';

/**
 * The members of Custom Attachment Location's API this module calls, so a record that lacks either is passed over.
 */
const CUSTOM_ATTACHMENT_LOCATION_ATTACHMENT_PATH_API_CONTRACT: PluginApiContract = {
  getAvailablePathForAttachments: {},
  isAttachmentUnitFolder: {}
};

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
 * Parameters for {@link getAttachmentFolderPathSyncOrNull}.
 */
export interface GetAttachmentFolderPathSyncOrNullParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

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
 * Parameters for {@link getAttachmentFilePathSync}.
 */
interface GetAttachmentFilePathSyncParams {
  /**
   * An Obsidian application instance.
   */
  readonly app: App;

  /**
   * A path of the note.
   */
  readonly notePathOrFile: PathOrFile;

  /**
   * A path of the attachment.
   */
  readonly oldAttachmentPathOrFile: PathOrFile;

  /**
   * Should the duplicate check be skipped.
   */
  readonly shouldSkipDuplicateCheck: boolean;
}

/**
 * Parameters for {@link getAvailablePathForAttachmentsSync}.
 */
interface GetAvailablePathForAttachmentsSyncParams {
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
}

/**
 * Parameters for {@link resolveAttachmentFolder}.
 */
interface ResolveAttachmentFolderParams {
  /**
   * An Obsidian application instance.
   */
  readonly app: App;

  /**
   * A file to attach to.
   */
  readonly notePathOrFile: null | PathOrFile;
}

/**
 * The attachment folder a note resolves to, before the attachment file name is appended.
 */
interface ResolveAttachmentFolderResult {
  /**
   * The attachment folder, or `null` when it does not exist in the vault yet.
   */
  readonly folder: null | TFolder;

  /**
   * The normalized attachment folder path, whether or not the folder exists.
   */
  readonly path: string;

  /**
   * The part of the `attachmentFolderPath` setting that follows `./`, or `null` when the setting is not
   * relative to the note. Only a relative setting may have its missing folder created.
   */
  readonly relativePath: null | string;
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

  const customAttachmentLocationApi = findCustomAttachmentLocationApi();
  if (!customAttachmentLocationApi) {
    // Nobody overrides the resolution, so it is entirely synchronous.
    // The same core answers `getAttachmentFolderPathSyncOrNull`, which is what keeps the two in step.
    return getAttachmentFilePathSync({
      app,
      notePathOrFile,
      oldAttachmentPathOrFile,
      shouldSkipDuplicateCheck
    });
  }

  const attachmentPath = getPath(app, oldAttachmentPathOrFile);
  const attachmentFileExtension = extname(attachmentPath);
  const attachmentFileBaseName = basename(attachmentPath, attachmentFileExtension);
  const attachmentFile = getFileOrNull({ app, pathOrFile: attachmentPath });

  return await customAttachmentLocationApi.getAvailablePathForAttachments({
    attachmentFileBaseName,
    attachmentFileExtension: attachmentFileExtension.slice(1),
    attachmentFileStats: attachmentFile?.stat,
    context: params.context,
    notePathOrFile,
    oldAttachmentPathOrFile,
    oldNotePathOrFile: params.oldNotePathOrFile,
    readAttachmentFileContent: attachmentFile ? (): Promise<ArrayBuffer> => app.vault.readBinary(attachmentFile) : null,
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
 * Retrieves the attachment folder path for a given note **synchronously**, when that is possible at all.
 *
 * Obsidian builds its file/folder context menus and evaluates a command's `checkCallback` synchronously, so a
 * caller deciding whether to merely *offer* a command cannot await {@link getAttachmentFolderPath}. This is
 * the synchronous twin such a caller can use instead.
 *
 * The answer is `null` when it is not knowable synchronously — that is, when Custom Attachment Location publishes
 * its attachment-path API and therefore owns the resolution, which is genuinely asynchronous. `null` means "ask {@link getAttachmentFolderPath}", never "there is no attachment
 * folder". Otherwise the answer is exact rather than a guess: it is produced by the very same code
 * {@link getAttachmentFolderPath} runs, whose only asynchronous step — creating a missing attachment folder —
 * is unreachable on this path.
 *
 * There is deliberately no `context` parameter: {@link AttachmentPathContext} only ever reaches that plugin's
 * resolver, and this function answers `null` whenever it is published.
 *
 * @param params - Parameters for the get attachment folder path sync or null function.
 * @returns The attachment folder path, or `null` when it can only be resolved asynchronously.
 */
export function getAttachmentFolderPathSyncOrNull(params: GetAttachmentFolderPathSyncOrNullParams): null | string {
  const {
    app,
    notePathOrFile
  } = params;

  return findCustomAttachmentLocationApi()
    ? null
    : parentFolderPath(getAttachmentFilePathSync({
      app,
      notePathOrFile,
      oldAttachmentPathOrFile: DUMMY_PATH,
      shouldSkipDuplicateCheck: true
    }));
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
    notePathOrFile,
    shouldSkipMissingAttachmentFolderCreation
  } = params;

  // Materializing a missing attachment folder is the ONE genuinely asynchronous step in this function.
  // Everything else lives in the synchronous core, which the synchronous entry points reuse verbatim.
  const attachmentFolder = resolveAttachmentFolder({ app, notePathOrFile });
  if (!attachmentFolder.folder && attachmentFolder.relativePath && !shouldSkipMissingAttachmentFolderCreation) {
    await app.vault.createFolder(attachmentFolder.path);
  }

  return getAvailablePathForAttachmentsSync(params);
}

/**
 * Reads the attachment-unit-folder designation Custom Attachment Location publishes through its plugin API.
 *
 * The designation is one plugin's setting but every relocating plugin's business, so it is read from the same
 * API that answers the attachment path itself. Reading it here rather than having each caller look for the
 * plugin is the point — a folder kept whole by one plugin and torn apart by another is exactly the failure
 * `findAttachmentUnitFolderPath` exists to prevent.
 *
 * `undefined` means nobody published a designation, the same "nobody owns this policy" answer that sends
 * {@link getAttachmentFilePath} to Obsidian's own resolution. It is distinct from a designation that answers
 * `false` for every folder.
 *
 * The registry is looked up once, when this is called, so a caller walking a folder's ancestors asks the same
 * API all the way up.
 *
 * @param _app - An Obsidian application instance. Unused since the answer comes from the plugin API registry;
 *   kept so existing callers compile unchanged.
 * @returns The designation predicate, or `undefined` when nobody published one.
 */
export function getCheckIsAttachmentUnitFolderFunction(_app: App): ((folderPath: string) => boolean) | undefined {
  const customAttachmentLocationApi = findCustomAttachmentLocationApi();
  return customAttachmentLocationApi
    ? (folderPath: string): boolean => customAttachmentLocationApi.isAttachmentUnitFolder({ folderPath })
    : undefined;
}

/**
 * Checks whether a note's attachment folder is specific to that note rather than shared with its siblings.
 *
 * The answer is derived by comparing the note's attachment folder with the one a same-folder sibling note
 * would get: they differ only when the folder depends on the note's NAME. Every built-in
 * `attachmentFolderPath` mode — the vault root, a fixed folder, the note's own folder (`./`), a subfolder of
 * the note's folder (`./sub`) — is shared by every note in that folder, so it answers `false`; `true` arises
 * from Custom Attachment Location's resolver deriving the folder from the note's name.
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
 * Finds Custom Attachment Location's attachment-path API in the plugin API registry. Its presence is the
 * synchronous probe for "somebody else owns the resolution".
 *
 * @returns The API, or `null` when that plugin publishes no record satisfying the range and contract.
 */
function findCustomAttachmentLocationApi(): CustomAttachmentLocationAttachmentPathApi | null {
  return findPluginApi<CustomAttachmentLocationAttachmentPathApi>({
    apiVersionRange: CUSTOM_ATTACHMENT_LOCATION_ATTACHMENT_PATH_API_VERSION_RANGE,
    contract: CUSTOM_ATTACHMENT_LOCATION_ATTACHMENT_PATH_API_CONTRACT,
    pluginId: CUSTOM_ATTACHMENT_LOCATION_PLUGIN_ID
  });
}

/**
 * The synchronous core of {@link getAttachmentFilePath}, reached when Custom Attachment Location publishes no
 * attachment-path API.
 *
 * @param params - Parameters for the get attachment file path sync function.
 * @returns The file path of the attachment.
 */
function getAttachmentFilePathSync(params: GetAttachmentFilePathSyncParams): string {
  const {
    app,
    notePathOrFile,
    oldAttachmentPathOrFile,
    shouldSkipDuplicateCheck
  } = params;
  const attachmentPath = getPath(app, oldAttachmentPathOrFile);
  const attachmentFileExtension = extname(attachmentPath);

  return getAvailablePathForAttachmentsSync({
    app,
    attachmentFileBaseName: basename(attachmentPath, attachmentFileExtension),
    attachmentFileExtension: attachmentFileExtension.slice(1),
    notePathOrFile,
    shouldSkipDuplicateCheck
  });
}

/**
 * The synchronous core of {@link getAvailablePathForAttachments}, which cannot create a missing attachment
 * folder. Its caller creates the folder first when that is wanted.
 *
 * @param params - Parameters for the get available path for attachments sync function.
 * @returns The available path for attachments.
 */
function getAvailablePathForAttachmentsSync(params: GetAvailablePathForAttachmentsSyncParams): string {
  const {
    app,
    attachmentFileExtension,
    notePathOrFile,
    shouldSkipDuplicateCheck
  } = params;
  const attachmentFolder = resolveAttachmentFolder({ app, notePathOrFile });
  const attachmentFileBaseName = normalizeString(normalizeSlashes(params.attachmentFileBaseName));

  // A folder that does not exist yet still owns the attachment path.
  // Resolving it as a non-existing folder stops the answer from collapsing to the vault root.
  const folder = attachmentFolder.folder ?? getFolder({ app, pathOrFolder: attachmentFolder.path, shouldIncludeNonExisting: true });

  const prefix = folder.getParentPrefix();
  return shouldSkipDuplicateCheck
    ? makeFileName({
      fileBaseName: prefix + attachmentFileBaseName,
      fileExtension: attachmentFileExtension
    })
    : app.vault.getAvailablePath(prefix + attachmentFileBaseName, attachmentFileExtension);
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

/**
 * Resolves the `attachmentFolderPath` setting against a note into a concrete attachment folder.
 *
 * @param params - Parameters for the resolve attachment folder function.
 * @returns The resolved attachment folder.
 */
function resolveAttachmentFolder(params: ResolveAttachmentFolderParams): ResolveAttachmentFolderResult {
  const {
    app,
    notePathOrFile
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

  return {
    folder: getFolderOrNull({ app, isCaseInsensitive: true, pathOrFolder: attachmentFolderPath }),
    path: attachmentFolderPath,
    relativePath
  };
}
