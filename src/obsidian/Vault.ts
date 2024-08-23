/**
 * @module Vault
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
  type MaybePromise,
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
 * Processes a file with retry logic.
 *
 * @param app - The application instance.
 * @param pathOrFile - The file to process.
 * @param processFn - The function to process the file's content.
 * @param retryOptions - Optional retry options.
 * @returns A promise that resolves when the processing is complete.
 */
export async function processWithRetry(app: App, pathOrFile: PathOrFile, processFn: (content: string) => MaybePromise<string | null>, retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  const file = getFile(app, pathOrFile);
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  await retryWithTimeout(async () => {
    const oldContent = await app.vault.adapter.read(file.path);
    const newContent = await processFn(oldContent);
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
 * Applies file changes to the specified file in the Obsidian vault.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The file to apply changes to.
 * @param changesFn - A function that returns the changes to be applied.
 * @param retryOptions - Optional retry options for the process.
 * @returns A promise that resolves when the changes have been applied successfully.
 */
export async function applyFileChanges(app: App, pathOrFile: PathOrFile, changesFn: () => MaybePromise<FileChange[]>, retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  await processWithRetry(app, pathOrFile, async (content) => {
    let changes = await changesFn();

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
 * @returns A promise that resolves when the folder is created successfully.
 * @throws If an error occurs while creating the folder and it still doesn't exist.
 */
export async function createFolderSafe(app: App, path: string): Promise<void> {
  if (await app.vault.adapter.exists(path)) {
    return;
  }

  try {
    await app.vault.adapter.mkdir(path);
  } catch (e) {
    if (!await app.vault.adapter.exists(path)) {
      throw e;
    }
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
