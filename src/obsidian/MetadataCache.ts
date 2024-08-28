/**
 * @packageDocumentation MetadataCache
 * This module provides utility functions for working with the metadata cache in Obsidian.
 */

import {
  TFile,
  type App,
  type CachedMetadata,
  type LinkCache,
  type MarkdownView,
  type ReferenceCache,
  type TAbstractFile
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
import type { CombinedFrontMatter } from "./FrontMatter.ts";

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
    backlinks = tempRegisterFileAndRun(app, file, () => app.metadataCache.getBacklinksForFile(file));
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
 * Retrieves the front matter from the metadata cache safely.
 *
 * @typeParam CustomFrontMatter - The type of custom front matter.
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file to retrieve the front matter from.
 * @returns The combined front matter.
 */
export async function getFrontMatterSafe<CustomFrontMatter = unknown>(app: App, pathOrFile: PathOrFile): Promise<CombinedFrontMatter<CustomFrontMatter>> {
  const cache = await getCacheSafe(app, pathOrFile);
  return (cache?.frontmatter ?? {}) as CombinedFrontMatter<CustomFrontMatter>;
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
  if (!file.deleted) {
    return fn();
  }

  const deletedPaths: string[] = [];

  let deletedFile: TAbstractFile = file;

  while (deletedFile.deleted) {
    deletedPaths.push(deletedFile.path);
    app.vault.fileMap[deletedFile.path] = deletedFile;
    deletedFile = deletedFile.parent!;
  }

  if (file instanceof TFile) {
    app.metadataCache.uniqueFileLookup.add(file.name.toLowerCase(), file);
  }

  try {
    return fn();
  } finally {
    for (const path of deletedPaths) {
      delete app.vault.fileMap[path];
    }

    if (file instanceof TFile) {
      app.metadataCache.uniqueFileLookup.remove(file.name.toLowerCase(), file);
    }
  }
}
