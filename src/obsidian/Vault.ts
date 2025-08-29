/**
 * @packageDocumentation
 *
 * This module provides utility functions for working with the Obsidian Vault.
 */

import type {
  App,
  ListedFiles,
  TFile,
  TFolder
} from 'obsidian';

import { MarkdownView } from 'obsidian';
import {
  parentFolderPath,
  ViewType
} from 'obsidian-typings/implementations';

import type { RetryOptions } from '../Async.ts';
import type { ValueProvider } from '../ValueProvider.ts';
import type {
  PathOrFile,
  PathOrFolder
} from './FileSystem.ts';

import { retryWithTimeout } from '../Async.ts';
import { noopAsync } from '../Function.ts';
import {
  basename,
  dirname,
  extname,
  join
} from '../Path.ts';
import { resolveValue } from '../ValueProvider.ts';
import {
  getFile,
  getFileOrNull,
  getFolder,
  getFolderOrNull,
  getPath,
  isFile,
  isMarkdownFile,
  isNote
} from './FileSystem.ts';

/**
 * Options for {@link process}.
 */
export interface ProcessOptions extends RetryOptions {
  /**
   * If `true`, the function will throw an error if the file is missing or deleted.
   */
  shouldFailOnMissingFile?: boolean;
}

/**
 * Copies a file safely in the vault.
 *
 * @param app - The application instance.
 * @param oldPathOrFile - The old path or file to copy.
 * @param newPath - The new path to copy the file to.
 * @returns A {@link Promise} that resolves to the new path of the copied file.
 */
export async function copySafe(app: App, oldPathOrFile: PathOrFile, newPath: string): Promise<string> {
  const file = getFile(app, oldPathOrFile);

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
  let file = getFileOrNull(app, path);
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
    file = getFile(app, path);
    if (!file.deleted) {
      await app.fileManager.trashFile(file);
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
  let folder = getFolderOrNull(app, path);
  if (folder) {
    return noopAsync;
  }

  const folderPath = parentFolderPath(path);
  await createTempFolder(app, folderPath);

  const folderCleanup = await createTempFolder(app, parentFolderPath(path));

  await createFolderSafe(app, path);

  return async () => {
    folder = getFolder(app, path);
    if (!folder.deleted) {
      await app.fileManager.trashFile(folder);
    }
    await folderCleanup();
  };
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
  return app.vault.getAllLoadedFiles().filter((file) => isFile(file) && isNote(app, file)).sort((a, b) => a.path.localeCompare(b.path)) as TFile[];
}

/**
 * Gets a safe rename path for a file.
 *
 * @param app - The application instance.
 * @param oldPathOrFile - The old path or file to rename.
 * @param newPath - The new path to rename the file to.
 * @returns The safe rename path for the file.
 */
export function getSafeRenamePath(app: App, oldPathOrFile: PathOrFile, newPath: string): string {
  const oldPath = getPath(app, oldPathOrFile);

  if (app.vault.adapter.insensitive) {
    let folderPath = dirname(newPath);
    let nonExistingPath = basename(newPath);
    let folder: null | TFolder;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      folder = getFolderOrNull(app, folderPath, true);
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
 * @param app - The application instance.
 * @param pathOrFile - The path or file to execute the function with the file system lock of.
 * @param fn - The function to execute.
 */
export async function invokeWithFileSystemLock(app: App, pathOrFile: PathOrFile, fn: (content: string) => void): Promise<void> {
  const file = getFile(app, pathOrFile);
  await app.vault.process(file, (content) => {
    fn(content);
    return content;
  });
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
 * @param app - The application instance, typically used for accessing the vault.
 * @param pathOrFile - The path or file to be processed. It can be a string representing the path or a file object.
 * @param newContentProvider - A value provider that returns the new content based on the old content of the file.
 * It can be a string or a function that takes the old content as an argument and returns the new content.
 * If function is provided, it should return `null` if the process should be retried.
 * @param options - Optional options for processing/retrying the operation.
 *
 * @returns A {@link Promise} that resolves once the process is complete.
 *
 * @throws Will throw an error if the process fails after the specified number of retries or timeout.
 */
export async function process(
  app: App,
  pathOrFile: PathOrFile,
  newContentProvider: ValueProvider<null | string, [string]>,
  options: ProcessOptions = {}
): Promise<void> {
  const DEFAULT_RETRY_OPTIONS = {
    shouldFailOnMissingFile: true
  };
  const fullOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  await retryWithTimeout(async (abortSignal) => {
    abortSignal.throwIfAborted();

    const oldContent = await readSafe(app, pathOrFile);
    abortSignal.throwIfAborted();

    if (oldContent === null) {
      return handleMissingFile();
    }

    const newContent = await resolveValue(newContentProvider, abortSignal, oldContent);
    abortSignal.throwIfAborted();

    if (newContent === null) {
      return false;
    }

    let isSuccess = true;
    const doesFileExist = await invokeFileActionSafe(app, pathOrFile, async (file) => {
      abortSignal.throwIfAborted();
      await app.vault.process(file, (content) => {
        abortSignal.throwIfAborted();
        if (content !== oldContent) {
          console.warn('Content has changed since it was read. Retrying...', {
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
    });

    if (!doesFileExist) {
      return handleMissingFile();
    }

    return isSuccess;

    function handleMissingFile(): boolean {
      if (fullOptions.shouldFailOnMissingFile) {
        const path = getPath(app, pathOrFile);
        throw new Error(`File '${path}' not found`);
      }
      return true;
    }
  }, fullOptions);
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
  await invokeFileActionSafe(app, pathOrFile, async (file) => {
    content = await app.vault.read(file);
  });
  return content;
}

/**
 * Renames a file safely in the vault.
 * If the new path already exists, the file will be renamed to an available path.
 *
 * @param app - The application instance.
 * @param oldPathOrFile - The old path or file to rename.
 * @param newPath - The new path to rename the file to.
 * @returns A {@link Promise} that resolves to the new path of the file.
 */
export async function renameSafe(app: App, oldPathOrFile: PathOrFile, newPath: string): Promise<string> {
  const oldFile = getFile(app, oldPathOrFile, false, true);

  const newAvailablePath = getSafeRenamePath(app, oldPathOrFile, newPath);

  if (oldFile.path.toLowerCase() === newAvailablePath.toLowerCase()) {
    if (oldFile.path !== newPath) {
      await app.vault.rename(oldFile, newAvailablePath);
    }
    return newAvailablePath;
  }

  const newFolderPath = parentFolderPath(newAvailablePath);
  await createFolderSafe(app, newFolderPath);

  try {
    await app.vault.rename(oldFile, newAvailablePath);
  } catch (e) {
    if (!await app.vault.exists(newAvailablePath) || await app.vault.exists(oldFile.path)) {
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
  if (!isMarkdownFile(app, pathOrFile)) {
    return;
  }

  const path = getPath(app, pathOrFile);

  for (const leaf of app.workspace.getLeavesOfType(ViewType.Markdown)) {
    if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path && leaf.view.dirty) {
      await leaf.view.save();
    }
  }
}

async function invokeFileActionSafe(app: App, pathOrFile: PathOrFile, fileAction: (file: TFile) => Promise<void>): Promise<boolean> {
  const path = getPath(app, pathOrFile);
  let file = getFileOrNull(app, path);
  if (!file || file.deleted) {
    return false;
  }
  try {
    await fileAction(file);
    return true;
  } catch (e) {
    file = getFileOrNull(app, path);
    if (!file || file.deleted) {
      return false;
    }
    throw e;
  }
}
