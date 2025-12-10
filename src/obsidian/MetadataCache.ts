/**
 * @packageDocumentation
 *
 * This module provides utility functions for working with the metadata cache in Obsidian.
 */

import type {
  App,
  CachedMetadata,
  Reference,
  TAbstractFile
} from 'obsidian';
import type { CustomArrayDict } from 'obsidian-typings';

import {
  CustomArrayDictImpl,
  isFrontmatterLinkCache,
  isReferenceCache,
  parentFolderPath
} from 'obsidian-typings/implementations';

import type { RetryOptions } from '../Async.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { CombinedFrontmatter } from './Frontmatter.ts';

import { getNestedPropertyValue } from '../ObjectUtils.ts';
import { getObsidianDevUtilsState } from './App.ts';
import { retryWithTimeoutNotice } from './AsyncWithNotice.ts';
import {
  getFile,
  getFileOrNull,
  getFolder,
  getPath,
  isFile
} from './FileSystem.ts';
import { parseFrontmatter } from './Frontmatter.ts';
import {
  isFrontmatterLinkCacheWithOffsets,
  toFrontmatterLinkCacheWithOffsets
} from './FrontmatterLinkCacheWithOffsets.ts';
import { sortReferences } from './Reference.ts';
import {
  readSafe,
  saveNote
} from './Vault.ts';

/**
 * Wrapper for the getBacklinksForFile method that provides a safe overload.
 */
export interface GetBacklinksForFileSafeWrapper {
  /**
   * Retrieves the backlinks for a file safely.
   *
   * @param pathOrFile - The path or file object.
   * @returns A {@link Promise} that resolves to an array dictionary of backlinks.
   */
  safe(pathOrFile: PathOrFile): Promise<CustomArrayDict<Reference>>;
}

/**
 * Ensures that the metadata cache is ready for all files.
 *
 * @param app - The Obsidian app instance.
 * @returns A {@link Promise} that resolves when the metadata cache is ready.
 */
export async function ensureMetadataCacheReady(app: App): Promise<void> {
  await new Promise((resolve) => {
    app.metadataCache.onCleanCache(resolve);
  });
}

/**
 * Retrieves all links from the provided cache.
 *
 * @param cache - The cached metadata.
 * @returns An array of reference caches representing the links.
 */
export function getAllLinks(cache: CachedMetadata): Reference[] {
  let links: Reference[] = [];

  if (cache.links) {
    links.push(...cache.links);
  }

  if (cache.embeds) {
    links.push(...cache.embeds);
  }

  if (cache.frontmatterLinks) {
    links.push(...cache.frontmatterLinks);
  }

  sortReferences(links);

  // BUG: https://forum.obsidian.md/t/bug-duplicated-links-in-metadatacache-inside-footnotes/85551
  links = links.filter((link, index) => {
    if (index === 0) {
      return true;
    }

    const previousLink = links[index - 1];
    if (!previousLink) {
      return true;
    }

    if (isReferenceCache(link) && isReferenceCache(previousLink)) {
      return link.position.start.offset !== previousLink.position.start.offset;
    }

    if (isFrontmatterLinkCache(link) && isFrontmatterLinkCache(previousLink)) {
      const linkStartOffset = isFrontmatterLinkCacheWithOffsets(link) ? link.startOffset : 0;
      const previousLinkStartOffset = isFrontmatterLinkCacheWithOffsets(previousLink) ? previousLink.startOffset : 0;
      return link.key !== previousLink.key || isFrontmatterLinkCacheWithOffsets(link) !== isFrontmatterLinkCacheWithOffsets(previousLink)
        || linkStartOffset !== previousLinkStartOffset;
    }

    return true;
  });

  return links;
}

/**
 * Retrieves the backlinks for a file or path.
 * NOTE: The file may be non-existent.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file object.
 * @returns The backlinks for the file.
 */
export function getBacklinksForFileOrPath(app: App, pathOrFile: PathOrFile): CustomArrayDict<Reference> {
  const file = getFile(app, pathOrFile, true);
  return tempRegisterFilesAndRun(app, [file], () => app.metadataCache.getBacklinksForFile(file));
}

/**
 * Retrieves the backlinks for a file safely.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file object.
 * @param retryOptions - Optional retry options.
 * @returns A {@link Promise} that resolves to an array dictionary of backlinks.
 */
export async function getBacklinksForFileSafe(app: App, pathOrFile: PathOrFile, retryOptions: RetryOptions = {}): Promise<CustomArrayDict<Reference>> {
  const safeOverload = (app.metadataCache.getBacklinksForFile as Partial<GetBacklinksForFileSafeWrapper>).safe;
  if (safeOverload) {
    return safeOverload(pathOrFile);
  }
  let backlinks: CustomArrayDict<Reference> = new CustomArrayDictImpl<Reference>();
  await retryWithTimeoutNotice({
    async operationFn(abortSignal) {
      abortSignal.throwIfAborted();
      const file = getFile(app, pathOrFile);
      await ensureMetadataCacheReady(app);
      abortSignal.throwIfAborted();
      backlinks = getBacklinksForFileOrPath(app, file);
      for (const notePath of backlinks.keys()) {
        abortSignal.throwIfAborted();
        const note = getFileOrNull(app, notePath);
        if (!note) {
          return false;
        }

        await saveNote(app, note);
        abortSignal.throwIfAborted();

        const content = await readSafe(app, note);
        abortSignal.throwIfAborted();
        if (!content) {
          return false;
        }
        const frontmatter = parseFrontmatter(content);
        const links = backlinks.get(notePath);
        if (!links) {
          return false;
        }

        for (const link of links) {
          let actualLink: string;
          if (isReferenceCache(link)) {
            actualLink = content.slice(link.position.start.offset, link.position.end.offset);
          } else if (isFrontmatterLinkCache(link)) {
            const propertyValue = getNestedPropertyValue(frontmatter, link.key);
            if (typeof propertyValue !== 'string') {
              return false;
            }

            const linkWithOffsets = toFrontmatterLinkCacheWithOffsets(link);
            actualLink = propertyValue.slice(linkWithOffsets.startOffset, linkWithOffsets.endOffset);
          } else {
            return true;
          }
          if (actualLink !== link.original) {
            return false;
          }
        }
      }

      return true;
    },
    operationName: `Get backlinks for ${getPath(app, pathOrFile)}`,
    retryOptions
  });

  return backlinks;
}

/**
 * Retrieves the cached metadata for a given file or path.
 *
 * @param app - The Obsidian app instance.
 * @param fileOrPath - The file or path to retrieve the metadata for.
 * @returns The cached metadata for the file, or null if it doesn't exist.
 */
export async function getCacheSafe(app: App, fileOrPath: PathOrFile): Promise<CachedMetadata | null> {
  const file = getFileOrNull(app, fileOrPath);

  try {
    if (!file) {
      return null;
    }

    if (file.deleted) {
      return app.metadataCache.getFileCache(file);
    }

    await saveNote(app, file);

    const fileCacheEntry = app.metadataCache.fileCache[file.path];
    const isUpToDate = fileCacheEntry
      && fileCacheEntry.mtime === file.stat.mtime
      && fileCacheEntry.size === file.stat.size
      && app.metadataCache.metadataCache[fileCacheEntry.hash];
    if (!isUpToDate) {
      await app.metadataCache.computeFileMetadataAsync(file);
      await ensureMetadataCacheReady(app);
    }
    return app.metadataCache.getFileCache(file);
  } catch (error) {
    if (!file || file.deleted) {
      return null;
    }

    throw error;
  }
}

/**
 * Retrieves the front matter from the metadata cache safely.
 *
 * @typeParam CustomFrontmatter - The type of custom front matter.
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file to retrieve the front matter from.
 * @returns The combined front matter.
 */
export async function getFrontmatterSafe<CustomFrontmatter = unknown>(app: App, pathOrFile: PathOrFile): Promise<CombinedFrontmatter<CustomFrontmatter>> {
  const cache = await getCacheSafe(app, pathOrFile);
  return (cache?.frontmatter ?? {}) as CombinedFrontmatter<CustomFrontmatter>;
}

/**
 * Parses the metadata for a given string.
 *
 * @param app - The Obsidian app instance.
 * @param str - The string to parse the metadata for.
 * @returns The parsed metadata.
 */
export async function parseMetadata(app: App, str: string): Promise<CachedMetadata> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(str).buffer;
  return await app.metadataCache.computeMetadataAsync(buffer) ?? {};
}

/**
 * Registers the file cache for a non-existing file.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file to register the file cache for.
 * @param cache - The file cache to register.
 */
export function registerFileCacheForNonExistingFile(app: App, pathOrFile: PathOrFile, cache: CachedMetadata): void {
  const file = getFile(app, pathOrFile, true);
  if (!file.deleted) {
    throw new Error('File is existing');
  }

  app.metadataCache.fileCache[file.path] = {
    hash: file.path,
    mtime: 0,
    size: 0
  };

  app.metadataCache.metadataCache[file.path] = cache;
}

/**
 * Registers files in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param files - The files to register.
 */
export function registerFiles(app: App, files: TAbstractFile[]): void {
  const registeredFilesCounts = getRegisteredFilesCounts(app);

  for (let file of files) {
    while (file.deleted) {
      let count = registeredFilesCounts.get(file.path) ?? 0;
      count++;
      registeredFilesCounts.set(file.path, count);

      app.vault.fileMap[file.path] = file;

      if (isFile(file)) {
        app.metadataCache.uniqueFileLookup.add(file.name.toLowerCase(), file);
      }

      file = getFolder(app, parentFolderPath(file.path), true);
    }
  }
}

/**
 * Temporarily registers files and runs a function.
 *
 * @typeParam T - The type of the result of the function.
 * @param app - The Obsidian app instance.
 * @param files - The files to temporarily register.
 * @param fn - The function to run.
 * @returns The result of the function.
 */
export function tempRegisterFilesAndRun<T>(app: App, files: TAbstractFile[], fn: () => T): T {
  try {
    registerFiles(app, files);
    return fn();
  } finally {
    unregisterFiles(app, files);
  }
}

/**
 * Temporarily registers files and runs an async function.
 *
 * @typeParam T - The type of the result of the function.
 * @param app - The Obsidian app instance.
 * @param files - The files to temporarily register.
 * @param fn - The function to run.
 * @returns The result of the function.
 */
export async function tempRegisterFilesAndRunAsync<T>(app: App, files: TAbstractFile[], fn: () => Promise<T>): Promise<T> {
  try {
    registerFiles(app, files);
    return await fn();
  } finally {
    unregisterFiles(app, files);
  }
}

/**
 * Unregisters the file cache for a non-existing file.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file to unregister the file cache for.
 */
export function unregisterFileCacheForNonExistingFile(app: App, pathOrFile: PathOrFile): void {
  const file = getFile(app, pathOrFile, true);
  if (!file.deleted) {
    throw new Error('File is existing');
  }
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- We have no other way to delete the property.
  delete app.metadataCache.fileCache[file.path];
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- We have no other way to delete the property.
  delete app.metadataCache.metadataCache[file.path];
}

/**
 * Unregisters files from the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param files - The files to unregister.
 */
export function unregisterFiles(app: App, files: TAbstractFile[]): void {
  const registeredFilesCounts = getRegisteredFilesCounts(app);

  for (let file of files) {
    while (file.deleted) {
      let count = registeredFilesCounts.get(file.path) ?? 1;
      count--;
      registeredFilesCounts.set(file.path, count);
      if (count === 0) {
        registeredFilesCounts.delete(file.path);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- We have no other way to delete the property.
        delete app.vault.fileMap[file.path];

        if (isFile(file)) {
          app.metadataCache.uniqueFileLookup.remove(file.name.toLowerCase(), file);
        }
      }

      file = getFolder(app, parentFolderPath(file.path), true);
    }
  }
}

function getRegisteredFilesCounts(app: App): Map<string, number> {
  return getObsidianDevUtilsState(app, 'registeredFilesCounts', new Map<string, number>()).value;
}
