/**
 * @packageDocumentation MetadataCache
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
  parentFolderPath
} from 'obsidian-typings/implementations';

import type { RetryOptions } from '../Async.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { CombinedFrontmatter } from './Frontmatter.ts';

import { retryWithTimeout } from '../Async.ts';
import { noop } from '../Function.ts';
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
import { sortReferences } from './Reference.ts';

/**
 * Wrapper for the getBacklinksForFile method that provides a safe overload.
 */
export interface GetBacklinksForFileSafeWrapper {
  /**
   * Retrieves the backlinks for a file safely.
   *
   * @param pathOrFile - The path or file object.
   * @returns A promise that resolves to an array dictionary of backlinks.
   */
  safe(pathOrFile: PathOrFile): Promise<CustomArrayDict<Reference>>;
}

/**
 * Ensures that the metadata cache is ready for all files.
 * @param app - The Obsidian app instance.
 * @returns A promise that resolves when the metadata cache is ready.
 */
export async function ensureMetadataCacheReady(app: App): Promise<void> {
  for (const [path, cache] of Object.entries(app.metadataCache.fileCache)) {
    if (!cache.hash) {
      continue;
    }

    if (app.metadataCache.metadataCache[cache.hash]) {
      continue;
    }

    await getCacheSafe(app, path);
  }
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
      return link.key !== previousLink.key;
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
  return tempRegisterFileAndRun(app, file, () => app.metadataCache.getBacklinksForFile(file));
}

/**
 * Retrieves the backlinks for a file safely.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file object.
 * @param retryOptions - Optional retry options.
 * @returns A promise that resolves to an array dictionary of backlinks.
 */
export async function getBacklinksForFileSafe(app: App, pathOrFile: PathOrFile, retryOptions: Partial<RetryOptions> = {}): Promise<CustomArrayDict<Reference>> {
  const safeOverload = (app.metadataCache.getBacklinksForFile as Partial<GetBacklinksForFileSafeWrapper>).safe;
  if (safeOverload) {
    return safeOverload(pathOrFile);
  }
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
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

      const content = await app.vault.read(note);
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
  }, overriddenOptions);

  return backlinks;
}

/**
 * Retrieves the cached metadata for a given file or path.
 *
 * @param app - The Obsidian app instance.
 * @param fileOrPath - The file or path to retrieve the metadata for.
 * @param retryOptions - Optional retry options for the retrieval process.
 * @returns The cached metadata for the file, or null if it doesn't exist.
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
    } else if (file.stat.mtime < stat.mtime) {
      app.vault.onChange('modified', file.path, undefined, stat);
      console.debug(`Cached timestamp for ${file.path} is from ${new Date(file.stat.mtime).toString()} which is older than the file system modification timestamp ${new Date(stat.mtime).toString()}`);
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

/***
 * Registers a file in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param file - The file to register.
 * @returns A function that unregisters the file.
 */
export function registerFile(app: App, file: TAbstractFile): () => void {
  if (!file.deleted) {
    return noop;
  }

  const deletedPaths: string[] = [];

  let deletedFile: TAbstractFile = file;

  while (deletedFile.deleted) {
    deletedPaths.push(deletedFile.path);
    app.vault.fileMap[deletedFile.path] = deletedFile;
    deletedFile = deletedFile.parent ?? getFolder(app, parentFolderPath(deletedFile.path), true);
  }

  if (isFile(file)) {
    app.metadataCache.uniqueFileLookup.add(file.name.toLowerCase(), file);
  }

  return () => {
    for (const path of deletedPaths) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete app.vault.fileMap[path];
    }

    if (isFile(file)) {
      app.metadataCache.uniqueFileLookup.remove(file.name.toLowerCase(), file);
    }
  };
}

/**
 * Temporarily registers a file and runs a function.
 *
 * @param app - The Obsidian app instance.
 * @param file - The file to temporarily register.
 * @param fn - The function to run.
 * @returns The result of the function.
 */
export function tempRegisterFileAndRun<T>(app: App, file: TAbstractFile, fn: () => T): T {
  const unregister = registerFile(app, file);

  try {
    return fn();
  } finally {
    unregister();
  }
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

  for (const leaf of app.workspace.getLeavesOfType('markdown')) {
    if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) {
      await leaf.view.save();
    }
  }
}
