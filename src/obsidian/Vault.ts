/**
 * @packageDocumentation Vault
 * This module provides utility functions for working with the Obsidian Vault.
 */

import {
  App,
  Notice,
  TFile,
  TFolder,
  type ListedFiles
} from "obsidian";
import { deepEqual } from "../Object.ts";
import {
  retryWithTimeout,
  type RetryOptions
} from "../Async.ts";
import { getBacklinksForFileSafe } from "./MetadataCache.ts";
import { printError } from "../Error.ts";
import { toJson } from "../JSON.ts";
import {
  getFile,
  type PathOrFile
} from "./TFile.ts";
import { getPath } from "./TAbstractFile.ts";
import {
  getFolderOrNull,
  type PathOrFolder
} from "./TFolder.ts";
import {
  resolveValue,
  type ValueProvider
} from "../ValueProvider.ts";
import { dirname } from "../Path.ts";

/**
 * Represents a file change in the Vault.
 */
export type FileChange = {
  startIndex: number;
  endIndex: number;
  oldContent: string;
  newContent: string;
};

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
 * Processes a file with retry logic, updating its content based on a provided value or function.
 *
 * @param app - The application instance, typically used for accessing the vault.
 * @param pathOrFile - The path or file to be processed. It can be a string representing the path or a file object.
 * @param newContentProvider - A value provider that returns the new content based on the old content of the file.
 * It can be a string or a function that takes the old content as an argument and returns the new content.
 * If function is provided, it should return `null` if the process should be retried.
 * @param retryOptions - Optional. Configuration options for retrying the process. If not provided, default options will be used.
 *
 * @returns A promise that resolves once the process is complete.
 *
 * @throws Will throw an error if the process fails after the specified number of retries or timeout.
 */
export async function processWithRetry(app: App, pathOrFile: PathOrFile, newContentProvider: ValueProvider<string | null, [string]>, retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  const file = getFile(app, pathOrFile);
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  await retryWithTimeout(async () => {
    const oldContent = await app.vault.adapter.read(file.path);
    const newContent = await resolveValue(newContentProvider, oldContent);
    if (newContent === null) {
      return false;
    }
    let success = true;
    await app.vault.process(file, (content) => {
      if (content !== oldContent) {
        console.warn(`Content of ${file.path} has changed since it was read. Retrying...`);
        success = false;
        return content;
      }

      return newContent;
    });

    return success;
  }, overriddenOptions);
}

/**
 * Applies a series of file changes to the specified file or path within the application.
 *
 * @param app - The application instance where the file changes will be applied.
 * @param pathOrFile - The path or file to which the changes should be applied.
 * @param changesProvider - A provider that returns an array of file changes to apply.
 * @param retryOptions - Optional settings that determine how the operation should retry on failure.
 *
 * @returns A promise that resolves when the file changes have been successfully applied.
 */
export async function applyFileChanges(app: App, pathOrFile: PathOrFile, changesProvider: ValueProvider<FileChange[]>, retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  await processWithRetry(app, pathOrFile, async (content) => {
    let changes = await resolveValue(changesProvider);

    for (const change of changes) {
      const actualContent = content.slice(change.startIndex, change.endIndex);
      if (actualContent !== change.oldContent) {
        console.warn(`Content mismatch at ${change.startIndex}-${change.endIndex} in ${getPath(pathOrFile)}:\nExpected: ${change.oldContent}\nActual: ${actualContent}`);
        return null;
      }
    }

    changes.sort((a, b) => a.startIndex - b.startIndex);

    // BUG: https://forum.obsidian.md/t/bug-duplicated-links-in-metadatacache-inside-footnotes/85551
    changes = changes.filter((change, index) => {
      if (index === 0) {
        return true;
      }
      return !deepEqual(change, changes[index - 1]);
    });

    for (let i = 1; i < changes.length; i++) {
      const change = changes[i]!;
      const previousChange = changes[i - 1]!;
      if (previousChange.endIndex > change.startIndex) {
        console.warn(`Overlapping changes:\n${toJson(previousChange)}\n${toJson(change)}`);
        return null;
      }
    }

    let newContent = "";
    let lastIndex = 0;

    for (const change of changes) {
      newContent += content.slice(lastIndex, change.startIndex);
      newContent += change.newContent;
      lastIndex = change.endIndex;
    }

    newContent += content.slice(lastIndex);
    return newContent;
  }, overriddenOptions);
}

/**
 * Removes a folder and its contents safely from the vault.
 *
 * @param app - The Obsidian application instance.
 * @param folderPath - The path of the folder to be removed.
 * @param removedNotePath - Optional. The path of the note that triggered the removal.
 * @returns A promise that resolves to a boolean indicating whether the removal was successful.
 */
export async function removeFolderSafe(app: App, folderPath: string, removedNotePath?: string): Promise<boolean> {
  const folder = app.vault.getFolderByPath(folderPath);

  if (!folder) {
    return false;
  }

  let canRemove = true;

  for (const child of folder.children) {
    if (child instanceof TFile) {
      const backlinks = await getBacklinksForFileSafe(app, child);
      if (removedNotePath) {
        backlinks.removeKey(removedNotePath);
      }
      if (backlinks.count() !== 0) {
        new Notice(`Attachment ${child.path} is still used by other notes. It will not be deleted.`);
        canRemove = false;
      } else {
        try {
          await app.vault.delete(child);
        } catch (e) {
          if (await app.vault.adapter.exists(child.path)) {
            printError(new Error(`Failed to delete ${child.path}`, { cause: e }));
            canRemove = false;
          }
        }
      }
    } else if (child instanceof TFolder) {
      canRemove &&= await removeFolderSafe(app, child.path, removedNotePath);
    }
  }

  if (canRemove) {
    try {
      await app.vault.delete(folder, true);
    } catch (e) {
      if (await app.vault.adapter.exists(folder.path)) {
        printError(new Error(`Failed to delete ${folder.path}`, { cause: e }));
        canRemove = false;
      }
    }
  }

  return canRemove;
}

/**
 * Creates a folder safely in the specified path.
 *
 * @param app - The application instance.
 * @param path - The path of the folder to create.
 * @returns A promise that resolves to a boolean indicating whether the folder was created.
 * @throws If an error occurs while creating the folder and it still doesn't exist.
 */
export async function createFolderSafe(app: App, path: string): Promise<boolean> {
  if (await app.vault.adapter.exists(path)) {
    return false;
  }

  try {
    await app.vault.adapter.mkdir(path);
    return true;
  } catch (e) {
    if (!await app.vault.adapter.exists(path)) {
      throw e;
    }

    return true;
  }
}

/**
 * Safely lists the files and folders at the specified path in the vault.
 *
 * @param app - The Obsidian application instance.
 * @param path - The path to list files and folders from.
 * @returns A promise that resolves to a `ListedFiles` object containing the listed files and folders.
 */
export async function safeList(app: App, path: string): Promise<ListedFiles> {
  const EMPTY = { files: [], folders: [] };
  if (!(await app.vault.exists(path))) {
    return EMPTY;
  }

  try {
    return await app.vault.adapter.list(path);
  } catch (e) {
    if (await app.vault.adapter.exists(path)) {
      throw e;
    }
    return EMPTY;
  }
}

/**
 * Removes empty folder hierarchy starting from the given folder.
 *
 * @param app - The application instance.
 * @param pathOrFolder - The folder to start removing empty hierarchy from.
 * @returns A promise that resolves when the empty hierarchy is removed.
 */
export async function removeEmptyFolderHierarchy(app: App, pathOrFolder: PathOrFolder | null): Promise<void> {
  let folder = getFolderOrNull(app, pathOrFolder);

  while (folder) {
    if (folder.children.length > 0) {
      return;
    }
    await removeFolderSafe(app, folder.path);
    folder = folder.parent;
  }
}

/**
 * Creates a temporary file in the vault with parent folders if needed.
 * @param app - The application instance.
 * @param path - The path of the file to create.
 * @returns A promise that resolves to a function that can be called to delete the temporary file and all its created parents.
 */
export async function createTempFile(app: App, path: string): Promise<() => Promise<void>> {
  let file = app.vault.getFileByPath(path);
  if (file) {
    return async () => {
    };
  }

  const folderCleanup = await createTempFolder(app, dirname(path));

  try {
    await app.vault.create(path, "");
  } catch (e) {
    file = app.vault.getFileByPath(path);
    if (!file) {
      throw e;
    }
  }

  file = file!;

  return async () => {
    if (!file.deleted) {
      await app.vault.delete(file, true);
    }
    await folderCleanup();
  };
}

/**
 * Creates a temporary folder in the vault with parent folders if needed.
 * @param app - The application instance.
 * @param path - The path of the folder to create.
 * @returns - A promise that resolves to a function that can be called to delete the temporary folder and all its created parents.
 */
export async function createTempFolder(app: App, path: string): Promise<() => Promise<void>> {
  let folder = app.vault.getFolderByPath(path);
  if (folder) {
    return async () => {
    };
  }

  const dirPath = dirname(path);
  await createTempFolder(app, dirPath);

  const folderCleanup = await createTempFolder(app, dirname(path));

  await createFolderSafe(app, path);

  folder = app.vault.getFolderByPath(path)!;

  return async () => {
    if (!folder.deleted) {
      await app.vault.delete(folder, true);
    }
    await folderCleanup();
  };
}
