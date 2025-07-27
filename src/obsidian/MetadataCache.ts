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

import { MarkdownView } from 'obsidian';
import {
  isFrontmatterLinkCache,
  isReferenceCache,
  parentFolderPath,
  ViewType
} from 'obsidian-typings/implementations';

import type { RetryOptions } from '../Async.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { CombinedFrontmatter } from './Frontmatter.ts';

import { retryWithTimeout } from '../Async.ts';
import { getNestedPropertyValue } from '../Object.ts';
import {
  getFile,
  getFileOrNull,
  getFolder,
  getPath,
  isFile,
  isMarkdownFile
} from './FileSystem.ts';
import { parseFrontmatter } from './Frontmatter.ts';
import { isFrontmatterLinkCacheWithOffsets } from './FrontmatterLinkCacheWithOffsets.ts';
import { sortReferences } from './Reference.ts';
import { readSafe } from './Vault.ts';

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
  let backlinks: CustomArrayDict<Reference> = null as unknown as CustomArrayDict<Reference>;
  await retryWithTimeout(async () => {
    const file = getFile(app, pathOrFile);
    await ensureMetadataCacheReady(app);
    backlinks = getBacklinksForFileOrPath(app, file);
    for (const notePath of backlinks.keys()) {
      const note = getFileOrNull(app, notePath);
      if (!note) {
        return false;
      }

      await saveNote(app, note);

      const content = await readSafe(app, note);
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
        } else if (isFrontmatterLinkCacheWithOffsets(link)) {
          const linkValue = getNestedPropertyValue(frontmatter, link.key);
          if (typeof linkValue !== 'string') {
            return false;
          }
          actualLink = linkValue.slice(link.startOffset, link.endOffset);
        } else if (isFrontmatterLinkCache(link)) {
          const linkValue = getNestedPropertyValue(frontmatter, link.key);
          if (typeof linkValue !== 'string') {
            return false;
          }
          actualLink = linkValue;
        } else {
          return true;
        }
        if (actualLink !== link.original) {
          return false;
        }
      }
    }

    return true;
  }, retryOptions);

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
  if (!file || file.deleted) {
    return null;
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
  const buffer = encoder.encode(str).buffer as ArrayBuffer;
  return await app.metadataCache.computeMetadataAsync(buffer) ?? {};
}

/**
 * Registers files in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param files - The files to register.
 * @returns A function that unregisters the files.
 */
export function registerFiles(app: App, files: TAbstractFile[]): () => void {
  const deletedPaths = new Set<string>();

  for (const file of files) {
    if (!file.deleted) {
      continue;
    }

    let deletedFile: TAbstractFile = file;

    while (deletedFile.deleted) {
      deletedPaths.add(deletedFile.path);
      app.vault.fileMap[deletedFile.path] = deletedFile;
      deletedFile = deletedFile.parent ?? getFolder(app, parentFolderPath(deletedFile.path), true);
    }

    if (isFile(file)) {
      app.metadataCache.uniqueFileLookup.add(file.name.toLowerCase(), file);
    }
  }

  return () => {
    for (const path of deletedPaths) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete app.vault.fileMap[path];
    }

    for (const file of files) {
      if (file.deleted && isFile(file)) {
        app.metadataCache.uniqueFileLookup.remove(file.name.toLowerCase(), file);
      }
    }
  };
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
  const unregister = registerFiles(app, files);

  try {
    return fn();
  } finally {
    unregister();
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
  const unregister = registerFiles(app, files);

  try {
    return await fn();
  } finally {
    unregister();
  }
}

/**
 * Saves the specified note in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The note to be saved.
 * @returns A {@link Promise} that resolves when the note is saved.
 */
async function saveNote(app: App, pathOrFile: PathOrFile): Promise<void> {
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
