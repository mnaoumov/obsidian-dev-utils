/**
 * @module MetadataCache
 * This module provides utility functions for working with the metadata cache in Obsidian.
 */

import type {
  App,
  CachedMetadata,
  LinkCache,
  MarkdownView,
  ReferenceCache,
} from "obsidian";
import {
  retryWithTimeout,
  type RetryOptions
} from "../Async.ts";
import type { CustomArrayDict } from "obsidian-typings";
import {
  getPath,
  isMarkdownFile
} from "./TAbstractFile.ts";
import {
  getFile,
  getFileOrNull,
  type PathOrFile
} from "./TFile.ts";

/**
 * Retrieves the cached metadata for a given file or path.
 *
 * @param {App} app - The Obsidian app instance.
 * @param {PathOrFile} fileOrPath - The file or path to retrieve the metadata for.
 * @param {Partial<RetryOptions>} [retryOptions] - Optional retry options for the retrieval process.
 * @returns {Promise<CachedMetadata | null>} The cached metadata for the file, or null if it doesn't exist.
 */
export async function getCacheSafe(app: App, fileOrPath: PathOrFile, retryOptions: Partial<RetryOptions> = {}): Promise<CachedMetadata | null> {
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let cache: CachedMetadata | null = null;

  await retryWithTimeout(async () => {
    const file = getFileOrNull(app, fileOrPath);

    if (!file || file.deleted) {
      cache = null;
      return true;
    }

    await saveNote(app, file);

    const fileInfo = app.metadataCache.getFileInfo(file.path);
    const stat = await app.vault.adapter.stat(file.path);

    if (!fileInfo) {
      console.debug(`File cache info for ${file.path} is missing`);
      return false;
    } else if (!stat) {
      console.debug(`File stat for ${file.path} is missing`);
      return false;
    } else if (fileInfo.mtime < stat.mtime) {
      console.debug(`File cache info for ${file.path} is from ${new Date(fileInfo.mtime).toString()} which is older than the file modification timestamp ${new Date(stat.mtime).toString()}`);
      return false;
    } else {
      cache = app.metadataCache.getFileCache(file);
      if (!cache) {
        console.debug(`File cache for ${file.path} is missing`);
        return false;
      } else {
        return true;
      }
    }
  }, overriddenOptions);

  return cache;
}

/**
 * Retrieves all links from the provided cache.
 *
 * @param cache - The cached metadata.
 * @returns An array of reference caches representing the links.
 */
export function getAllLinks(cache: CachedMetadata): ReferenceCache[] {
  let links: ReferenceCache[] = [];

  if (cache.links) {
    links.push(...cache.links);
  }

  if (cache.embeds) {
    links.push(...cache.embeds);
  }

  links.sort((a, b) => a.position.start.offset - b.position.start.offset);

  // BUG: https://forum.obsidian.md/t/bug-duplicated-links-in-metadatacache-inside-footnotes/85551
  links = links.filter((link, index) => {
    if (index === 0) {
      return true;
    }
    return link.position.start.offset !== links[index - 1]!.position.start.offset;
  });

  return links;
}

/**
 * Retrieves the backlinks for a file safely.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file object.
 * @param retryOptions - Optional retry options.
 * @returns A promise that resolves to an array dictionary of backlinks.
 */
export async function getBacklinksForFileSafe(app: App, pathOrFile: PathOrFile, retryOptions: Partial<RetryOptions> = {}): Promise<CustomArrayDict<LinkCache>> {
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let backlinks: CustomArrayDict<LinkCache> | null = null;
  await retryWithTimeout(async () => {
    const file = getFile(app, pathOrFile);
    backlinks = app.metadataCache.getBacklinksForFile(file);
    for (const notePath of backlinks.keys()) {
      const note = app.vault.getFileByPath(notePath);
      if (!note) {
        return false;
      }

      await saveNote(app, note);

      const content = await app.vault.read(note);
      const links = backlinks.get(notePath)!;
      for (const link of links) {
        const actualLink = content.slice(link.position.start.offset, link.position.end.offset);
        if (actualLink !== link.original) {
          return false;
        }
      }
    }

    return true;
  }, overriddenOptions);

  return backlinks!;
}

/**
 * Saves the specified note in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The note to be saved.
 * @returns A promise that resolves when the note is saved.
 */
async function saveNote(app: App, pathOrFile: PathOrFile): Promise<void> {
  if (!isMarkdownFile(pathOrFile)) {
    return;
  }

  const path = getPath(pathOrFile);

  for (const leaf of app.workspace.getLeavesOfType("markdown")) {
    const view = leaf.view as MarkdownView;
    if (view.file?.path === path) {
      await view.save();
    }
  }
}

/**
 * Retrieves the value of a specific front matter key from the metadata cache.
 *
 * @template T - The type of the value to retrieve.
 * @param {App} app - The Obsidian app instance.
 * @param {PathOrFile} pathOrFile - The path or file to retrieve the metadata cache for.
 * @param {string} key - The key of the front matter value to retrieve.
 * @returns {Promise<T | null>} - A promise that resolves to the value of the front matter key, or null if it does not exist.
 */
export async function getFrontMatterValue<T>(app: App, pathOrFile: PathOrFile, key: string): Promise<T | null> {
  const cache = await getCacheSafe(app, pathOrFile);
  if (!cache?.frontmatter) {
    return null;
  }

  const value = cache.frontmatter[key] as T;

  if (value === undefined) {
    return null;
  }

  return value;
}
