/**
 * @file
 *
 * This module provides utility functions for working with the Obsidian Vault.
 */

import type {
  App,
  ListedFiles
} from 'obsidian';

import {
  getDataAdapterEx,
  parentFolderPath,
  ViewType
} from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  MarkdownView,
  TAbstractFile,
  TFile,
  TFolder
} from 'obsidian';

import type { RetryOptions } from '../async.ts';
import type { ValueProvider } from '../value-provider.ts';
import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';
import type {
  PathOrAbstractFile,
  PathOrFile,
  PathOrFolder
} from './file-system.ts';
import type { ResourceLockComponent } from './resource-lock.ts';

import { abortSignalAny } from '../abort-controller.ts';
import { getLibDebugger } from '../debug.ts';
import { noopAsync } from '../function.ts';
import {
  basename,
  dirname,
  extname,
  join
} from '../path.ts';
import { strictProxy } from '../strict-proxy.ts';
import { assertNever } from '../type-guards.ts';
import { resolveValue } from '../value-provider.ts';
import { retryWithTimeoutNotice } from './async-with-notice.ts';
import {
  asFile,
  asFolder,
  FileSystemType,
  getAbstractFile,
  getAbstractFileOrNull,
  getFile,
  getFileOrNull,
  getFileSystemType,
  getFolder,
  getFolderOrNull,
  getPath,
  isFile,
  isMarkdownFile,
  isNote
} from './file-system.ts';
import { t } from './i18n/i18n.ts';

/**
 * Arguments for {@link process}.
 */
export interface ContentArgs {
  readonly content: string;
}

/**
 * Parameters for {@link copySafe}.
 */
export interface CopySafeParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The new path to copy the file to.
   */
  readonly newPath: string;

  /**
   * The old path or file to copy.
   */
  readonly oldPathOrFile: PathOrFile;
}

/**
 * Parameters for {@link getAbstractFilePathSafe}.
 */
export interface GetAbstractFilePathSafeParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The path of the file or folder to get a safe path for.
   */
  readonly path: string;

  /**
   * The type of the file system object.
   */
  readonly type: FileSystemType;
}

/**
 * Parameters for {@link getOrCreateAbstractFileSafe}.
 */
export interface GetOrCreateAbstractFileSafeParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The path of the abstract file to get or create.
   */
  readonly path: string;

  /**
   * The type of the abstract file to get or create.
   */
  readonly type: FileSystemType;
}

/**
 * Parameters for {@link getSafeRenamePath}.
 */
export interface GetSafeRenamePathParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The new path to rename the abstract file to.
   */
  readonly newPath: string;

  /**
   * The old path or abstract file to rename.
   */
  readonly oldPathOrAbstractFile: PathOrAbstractFile;
}

/**
 * Parameters for {@link invokeWithFileSystemLock}.
 */
export interface InvokeWithFileSystemLockParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The function to execute.
   *
   * @param content - The content of the file.
   */
  fn(this: void, content: string): void;

  /**
   * The path or file to execute the function with the file system lock of.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * Parameters for {@link isChildOrSelf}.
 */
export interface IsChildOrSelfParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The path or file to check whether it is a child or self.
   */
  readonly childPathOrFile: PathOrAbstractFile;

  /**
   * The path or file to check whether it is a parent or self.
   */
  readonly parentPathOrFile: PathOrAbstractFile;
}

/**
 * Parameters for {@link isChild}.
 */
export interface IsChildParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The path or file to check whether it is a child.
   */
  readonly childPathOrFile: PathOrAbstractFile;

  /**
   * The path or file to check whether it is a parent.
   */
  readonly parentPathOrFile: PathOrAbstractFile;
}

/**
 * Options for {@link process}.
 */
export interface ProcessOptions extends RetryOptions {
  /**
   * An resource-lock component used to lock the file's editor read-only for the duration of
   * processing. The lock is reference-counted, so it composes with any outer operation-level lock
   * on the same note.
   */
  readonly resourceLockComponent: null | ResourceLockComponent;

  /**
   * Whether to fail if the file is missing or deleted.
   *
   * @default `true`
   */
  readonly shouldFailOnMissingFile?: boolean;

  /**
   * Whether to show a timeout notice.
   *
   * @default `true`
   */
  readonly shouldShowTimeoutNotice?: boolean;
}

/**
 * Parameters for {@link process}.
 */
export interface ProcessParams extends ProcessOptions {
  /**
   * The application instance, typically used for accessing the vault.
   */
  readonly app: App;

  /**
   * A value provider that returns the new content based on the old content of the file.
   * It can be a string or a function that takes the old content as an argument and returns the new content.
   * If function is provided, it should return `null` if the process should be retried.
   */
  readonly newContentProvider: ValueProvider<null | string, ContentArgs>;

  /**
   * The path or file to be processed. It can be a string representing the path or a file object.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * Parameters for {@link renameSafe}.
 */
export interface RenameSafeParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The new path to rename the file to.
   */
  readonly newPath: string;

  /**
   * The old path or abstract file to rename.
   */
  readonly oldPathOrAbstractFile: PathOrAbstractFile;
}

interface InvokeFileActionSafeParams {
  /**
   * The application instance.
   */
  readonly app: App;

  /**
   * The action to perform on the file.
   *
   * @param file - The file to perform the action on.
   * @returns A {@link Promise} that resolves when the action is complete.
   */
  fileAction(this: void, file: TFile): Promise<void>;

  /**
   * The path or file to perform the action on.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * Copies a file safely in the vault.
 *
 * @param params - The parameters for copying the file.
 * @returns A {@link Promise} that resolves to the new path of the copied file.
 */
export async function copySafe(params: CopySafeParams): Promise<string> {
  const {
    app,
    newPath,
    oldPathOrFile
  } = params;
  const file = getFile({ app, pathOrFile: oldPathOrFile });

  if (file.path === newPath) {
    return newPath;
  }

  const newFolderPath = parentFolderPath(newPath);
  await createFolderSafe(app, newFolderPath);

  const newAvailablePath = getAvailablePath(app, newPath);

  try {
    await app.vault.copy(file, newAvailablePath);
  } catch (e) {
    if (!await app.vault.exists(newAvailablePath)) {
      throw e;
    }
  }

  return newAvailablePath;
}

/**
 * Creates a folder safely in the specified path.
 *
 * @param app - The application instance.
 * @param path - The path of the folder to create.
 * @returns A {@link Promise} that resolves to a boolean indicating whether the folder was created.
 * @throws If an error occurs while creating the folder and it still doesn't exist.
 */
export async function createFolderSafe(app: App, path: string): Promise<boolean> {
  if (await app.vault.adapter.exists(path)) {
    return false;
  }

  try {
    await app.vault.createFolder(path);
    return true;
  } catch (e) {
    if (!await app.vault.exists(path)) {
      throw e;
    }
    return true;
  }
}

/**
 * Creates a temporary file in the vault with parent folders if needed.
 *
 * @param app - The application instance.
 * @param path - The path of the file to create.
 * @returns A {@link Promise} that resolves to a function that can be called to delete the temporary file and all its created parents.
 */
export async function createTempFile(app: App, path: string): Promise<() => Promise<void>> {
  let file = getFileOrNull({ app, pathOrFile: path });
  if (file) {
    return noopAsync;
  }

  const folderCleanup = await createTempFolder(app, parentFolderPath(path));

  try {
    await app.vault.create(path, '');
  } catch (e) {
    if (!await app.vault.exists(path)) {
      throw e;
    }
  }

  return async () => {
    file = getFile({ app, pathOrFile: path });
    if (!file.deleted) {
      await trashSafe(app, file);
    }
    await folderCleanup();
  };
}

/**
 * Creates a temporary folder in the vault with parent folders if needed.
 *
 * @param app - The application instance.
 * @param path - The path of the folder to create.
 * @returns A {@link Promise} that resolves to a function that can be called to delete the temporary folder and all its created parents.
 */
export async function createTempFolder(app: App, path: string): Promise<() => Promise<void>> {
  let folder = getFolderOrNull({ app, pathOrFolder: path });
  if (folder) {
    return noopAsync;
  }

  const folderPath = parentFolderPath(path);
  await createTempFolder(app, folderPath);

  const folderCleanup = await createTempFolder(app, parentFolderPath(path));

  await createFolderSafe(app, path);

  return async () => {
    folder = getFolder({ app, pathOrFolder: path });
    if (!folder.deleted) {
      await trashSafe(app, folder);
    }
    await folderCleanup();
  };
}

/**
 * Deletes an empty folder.
 *
 * @param app - The application instance.
 * @param pathOrFolder - The folder to delete.
 * @returns A {@link Promise} that resolves when the folder is deleted.
 */
export async function deleteEmptyFolder(app: App, pathOrFolder: null | PathOrFolder): Promise<void> {
  const folder = getFolderOrNull({ app, pathOrFolder });
  if (!folder) {
    return;
  }
  if (!await isEmptyFolder(app, folder)) {
    return;
  }
  await trashSafe(app, folder);
}

/**
 * Removes empty folder hierarchy starting from the given folder.
 *
 * @param app - The application instance.
 * @param pathOrFolder - The folder to start removing empty hierarchy from.
 * @returns A {@link Promise} that resolves when the empty hierarchy is deleted.
 */
export async function deleteEmptyFolderHierarchy(app: App, pathOrFolder: null | PathOrFolder): Promise<void> {
  let folder = getFolderOrNull({ app, pathOrFolder });

  while (folder) {
    if (!await isEmptyFolder(app, folder)) {
      return;
    }
    const parent = folder.parent;
    await deleteEmptyFolder(app, folder);
    folder = parent;
  }
}

/**
 * Gets a safe path for a file or folder.
 *
 * @param params - The parameters for getting a safe path.
 * @returns The safe path for the file or folder.
 */
export function getAbstractFilePathSafe(params: GetAbstractFilePathSafeParams): string {
  const {
    app,
    path,
    type
  } = params;
  const abstractFile = getAbstractFileOrNull({ app, pathOrFile: path });

  if (abstractFile && getFileSystemType(abstractFile) === type) {
    return path;
  }

  return getAvailablePath(app, path);
}

/**
 * Gets an available path for a file in the vault.
 *
 * @param app - The application instance.
 * @param path - The path of the file to get an available path for.
 * @returns The available path for the file.
 */
export function getAvailablePath(app: App, path: string): string {
  const ext = extname(path);
  return app.vault.getAvailablePath(join(dirname(path), basename(path, ext)), ext.slice(1));
}

/**
 * Gets a safe file path for a file or folder.
 *
 * @param app - The application instance.
 * @param path - The path of the file or folder to get a safe path for.
 * @returns The safe path for the file or folder.
 */
export function getFilePathSafe(app: App, path: string): string {
  return getAbstractFilePathSafe({ app, path, type: FileSystemType.File });
}

/**
 * Gets a safe folder path for a file or folder.
 *
 * @param app - The application instance.
 * @param path - The path of the file or folder to get a safe path for.
 * @returns The safe path for the file or folder.
 */
export function getFolderPathSafe(app: App, path: string): string {
  return getAbstractFilePathSafe({ app, path, type: FileSystemType.Folder });
}

/**
 * Retrieves an array of Markdown files from the app's vault and sorts them alphabetically by their file path.
 *
 * @param app - The Obsidian app instance.
 * @returns An array of Markdown files sorted by file path.
 */
export function getMarkdownFilesSorted(app: App): TFile[] {
  return app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Retrieves an array of all note files from the app's vault and sorts them alphabetically by their file path.
 *
 * @param app - The Obsidian app instance.
 * @returns An array of all note files in the vault sorted by file path.
 */
export function getNoteFilesSorted(app: App): TFile[] {
  return app.vault.getAllLoadedFiles().filter((file) => isFile(file) && isNote(file)).sort((a, b) => a.path.localeCompare(b.path)) as TFile[];
}

/**
 * Gets or creates an abstract file safely in the specified path.
 *
 * If the file already exists, it will be returned.
 * If the file does not exist, it will be created and returned.
 *
 * @param params - The parameters for getting or creating the abstract file.
 * @returns A {@link Promise} that resolves to the abstract file.
 */
export async function getOrCreateAbstractFileSafe(params: GetOrCreateAbstractFileSafeParams): Promise<TAbstractFile> {
  const {
    app,
    type
  } = params;
  let { path } = params;
  path = getAbstractFilePathSafe({ app, path, type });
  const abstractFile = getAbstractFileOrNull({ app, pathOrFile: path });
  if (abstractFile) {
    return abstractFile;
  }

  switch (type) {
    case FileSystemType.File:
      return await app.vault.create(path, '');
    case FileSystemType.Folder:
      return await app.vault.createFolder(path);
    default:
      assertNever(type);
  }
}

/**
 * Gets or creates a file safely in the specified path.
 *
 * If the file already exists, it will be returned.
 * If the file does not exist, it will be created and returned.
 *
 * @param app - The application instance.
 * @param path - The path of the file to get or create.
 * @returns A {@link Promise} that resolves to the file.
 */
export async function getOrCreateFileSafe(app: App, path: string): Promise<TFile> {
  return asFile(await getOrCreateAbstractFileSafe({ app, path, type: FileSystemType.File }));
}

/**
 * Gets or creates a folder safely in the specified path.
 *
 * If the folder already exists, it will be returned.
 * If the folder does not exist, it will be created and returned.
 *
 * @param app - The application instance.
 * @param path - The path of the folder to get or create.
 * @returns A {@link Promise} that resolves to the folder.
 */
export async function getOrCreateFolderSafe(app: App, path: string): Promise<TFolder> {
  return asFolder(await getOrCreateAbstractFileSafe({ app, path, type: FileSystemType.Folder }));
}

/**
 * Gets a safe rename path for a file.
 *
 * @param params - The parameters for getting a safe rename path.
 * @returns The safe rename path for the abstract file.
 */
export function getSafeRenamePath(params: GetSafeRenamePathParams): string {
  const { app, oldPathOrAbstractFile } = params;
  let { newPath } = params;
  const oldPath = getPath(app, oldPathOrAbstractFile);

  if (getDataAdapterEx(app).insensitive) {
    let folderPath = dirname(newPath);
    let nonExistingPath = basename(newPath);
    let folder: null | TFolder;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- There is no elegant way to perform infinite loops.
    while (true) {
      folder = getFolderOrNull({ app, isCaseInsensitive: true, pathOrFolder: folderPath });
      if (folder) {
        break;
      }
      nonExistingPath = join(basename(folderPath), nonExistingPath);
      folderPath = dirname(folderPath);
    }
    newPath = join(folder.getParentPrefix(), nonExistingPath);
  }

  if (oldPath.toLowerCase() === newPath.toLowerCase()) {
    return newPath;
  }

  return getAvailablePath(app, newPath);
}

/**
 * Invokes a function with the file system lock.
 *
 * @param params - The parameters for invoking the function with the file system lock.
 * @returns A {@link Promise} that resolves when the function is invoked.
 */
export async function invokeWithFileSystemLock(params: InvokeWithFileSystemLockParams): Promise<void> {
  const {
    app,
    fn,
    pathOrFile
  } = params;
  const file = getFile({ app, pathOrFile });
  await app.vault.process(file, (content) => {
    fn(content);
    return content;
  });
}

/**
 * Checks if a path or file is a child of another path or file.
 *
 * @param params - The parameters for checking whether the child path or file is a child of the parent path or file.
 * @returns A boolean indicating whether the child path or file is a child of the parent path or file.
 */
export function isChild(params: IsChildParams): boolean {
  const {
    app,
    childPathOrFile,
    parentPathOrFile
  } = params;
  const childPath = getPath(app, childPathOrFile);
  const parentPath = getPath(app, parentPathOrFile);

  if (childPath === parentPath) {
    return false;
  }

  if (parentPath === '/') {
    return true;
  }

  return childPath.startsWith(`${parentPath}/`);
}

/**
 * Checks if a path or file is a child or self of another path or file.
 *
 * @param params - The parameters for checking whether the child path or file is a child or self of the parent path or file.
 * @returns A boolean indicating whether the child path or file is a child or self of the parent path or file.
 */
export function isChildOrSelf(params: IsChildOrSelfParams): boolean {
  const {
    app,
    childPathOrFile,
    parentPathOrFile
  } = params;
  const childPath = getPath(app, childPathOrFile);
  const parentPath = getPath(app, parentPathOrFile);
  return childPath === parentPath || isChild({ app, childPathOrFile, parentPathOrFile });
}

/**
 * Checks if a folder is empty.
 *
 * @param app - The application instance.
 * @param pathOrFolder - The path or folder to check.
 * @returns A {@link Promise} that resolves to a boolean indicating whether the folder is empty.
 */
export async function isEmptyFolder(app: App, pathOrFolder: PathOrFolder): Promise<boolean> {
  const listedFiles = await listSafe(app, getPath(app, pathOrFolder));
  return listedFiles.files.length === 0 && listedFiles.folders.length === 0;
}

/**
 * Safely lists the files and folders at the specified path in the vault.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFolder - The path or folder to list.
 * @returns A {@link Promise} that resolves to a {@link ListedFiles} object containing the listed files and folders.
 */
export async function listSafe(app: App, pathOrFolder: PathOrFolder): Promise<ListedFiles> {
  const path = getPath(app, pathOrFolder);
  const EMPTY = { files: [], folders: [] };

  if ((await app.vault.adapter.stat(path))?.type !== 'folder') {
    return EMPTY;
  }

  try {
    return await app.vault.adapter.list(path);
  } catch (e) {
    if (await app.vault.exists(path)) {
      throw e;
    }
    return EMPTY;
  }
}

/**
 * Processes a file with retry logic, updating its content based on a provided value or function.
 *
 * @param params - The parameters for processing the file.
 *
 * @returns A {@link Promise} that resolves once the process is complete.
 *
 * @throws Will throw an error if the process fails after the specified number of retries or timeout.
 */
export async function process(params: ProcessParams): Promise<void> {
  const {
    app,
    newContentProvider,
    pathOrFile,
    resourceLockComponent
  } = params;
  const DEFAULT_RETRY_OPTIONS = {
    shouldFailOnMissingFile: true,
    shouldShowTimeoutNotice: true,
    // eslint-disable-next-line no-magic-numbers -- Default value.
    timeoutInMilliseconds: 500
  };
  const fullOptions = { ...DEFAULT_RETRY_OPTIONS, ...params };
  const abortController = new AbortController();
  fullOptions.abortSignal = abortSignalAny(fullOptions.abortSignal, abortController.signal);
  const path = getPath(app, pathOrFile);

  // Reference-counted lock; composes with any outer lock. Released at function scope exit.
  using _lock = resourceLockComponent?.lockForPath(pathOrFile);

  await retryWithTimeoutNotice({
    async operationFn(abortSignal) {
      abortSignal.throwIfAborted();

      const oldContent = await readSafe(app, pathOrFile);
      abortSignal.throwIfAborted();

      if (oldContent === null) {
        return handleMissingFile();
      }

      const newContent = await resolveValue(newContentProvider, { abortSignal, content: oldContent });
      abortSignal.throwIfAborted();

      if (newContent === null) {
        return false;
      }

      let isSuccess = true;
      const doesFileExist = await invokeFileActionSafe({
        app,
        async fileAction(file) {
          abortSignal.throwIfAborted();
          await app.vault.process(file, (content) => {
            abortSignal.throwIfAborted();
            if (content !== oldContent) {
              getLibDebugger('Vault:process')('Content has changed since it was read. Retrying...', {
                actualContent: content,
                expectedContent: oldContent,
                path: file.path
              });
              isSuccess = false;
              return content;
            }

            return newContent;
          });

          abortSignal.throwIfAborted();
        },
        pathOrFile
      });

      if (!doesFileExist) {
        return handleMissingFile();
      }

      return isSuccess;

      function handleMissingFile(): boolean {
        if (fullOptions.shouldFailOnMissingFile) {
          throw new Error(`File '${path}' not found`);
        }
        return true;
      }
    },
    operationName: t(($) => $.obsidianDevUtils.vault.processFile, { filePath: path }),
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
    retryOptions: fullOptions,
    shouldShowTimeoutNotice: fullOptions.shouldShowTimeoutNotice
  });
}

/**
 * Reads the content of a file safely from the vault.
 *
 * It covers the case when the file was removed during the reading.
 *
 * @param app - The application instance.
 * @param pathOrFile - The path or file to read.
 * @returns A {@link Promise} that resolves to the content of the file or `null` if the file is missing or deleted.
 */
export async function readSafe(app: App, pathOrFile: PathOrFile): Promise<null | string> {
  let content: null | string = null;
  await invokeFileActionSafe({
    app,
    async fileAction(file) {
      await saveNote(app, file);
      content = await app.vault.read(file);
    },
    pathOrFile
  });
  return content;
}

/**
 * Renames a file safely in the vault.
 * If the new path already exists, the file will be renamed to an available path.
 *
 * @param params - The parameters for renaming the file.
 * @returns A {@link Promise} that resolves to the new path of the file.
 */
export async function renameSafe(params: RenameSafeParams): Promise<string> {
  const {
    app,
    newPath,
    oldPathOrAbstractFile
  } = params;
  const oldAbstractFile = getAbstractFile({ app, pathOrFile: oldPathOrAbstractFile });

  const newAvailablePath = getSafeRenamePath({ app, newPath, oldPathOrAbstractFile });

  if (oldAbstractFile.path.toLowerCase() === newAvailablePath.toLowerCase()) {
    if (oldAbstractFile.path !== newPath) {
      await app.fileManager.renameFile(oldAbstractFile, newAvailablePath);
    }
    return newAvailablePath;
  }

  const newFolderPath = parentFolderPath(newAvailablePath);
  await createFolderSafe(app, newFolderPath);

  try {
    await app.fileManager.renameFile(oldAbstractFile, newAvailablePath);
  } catch (e) {
    if (!await app.vault.exists(newAvailablePath) || await app.vault.exists(oldAbstractFile.path)) {
      throw e;
    }
  }

  return newAvailablePath;
}

/**
 * Saves the specified note in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The note to be saved.
 * @returns A {@link Promise} that resolves when the note is saved.
 */
export async function saveNote(app: App, pathOrFile: PathOrFile): Promise<void> {
  if (!isMarkdownFile(pathOrFile)) {
    return;
  }

  const path = getPath(app, pathOrFile);

  for (const leaf of app.workspace.getLeavesOfType(ViewType.Markdown)) {
    if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path && leaf.view.dirty) {
      await leaf.view.save();
    }
  }
}

/**
 * Trashes an abstract file safely from the vault.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or abstract file to trash.
 * @returns A {@link Promise} that resolves when the file is trashed.
 */
export async function trashSafe(app: App, pathOrFile: PathOrAbstractFile): Promise<void> {
  const file = getAbstractFileOrNull({ app, pathOrFile });
  if (!file) {
    return;
  }

  try {
    await app.fileManager.trashFile(file);
  } catch (e) {
    if (await app.vault.exists(file.path)) {
      throw e;
    }

    getLibDebugger('Vault:trashSafe')(`An error occurred while trashing ${file.path}, but the file no longer exists.`, { error: e, path: file.path });
  }
}

async function invokeFileActionSafe(params: InvokeFileActionSafeParams): Promise<boolean> {
  const {
    app,
    fileAction,
    pathOrFile
  } = params;
  const path = getPath(app, pathOrFile);
  let file = getFileOrNull({ app, pathOrFile: path });
  if (!file || file.deleted) {
    return false;
  }
  try {
    await fileAction(file);
    return true;
  } catch (e) {
    file = getFileOrNull({ app, pathOrFile: path });
    if (!file || file.deleted) {
      return false;
    }
    throw e;
  }
}
