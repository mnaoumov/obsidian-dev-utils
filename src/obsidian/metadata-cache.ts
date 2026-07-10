/**
 * @file
 *
 * This module provides utility functions for working with the metadata cache in Obsidian.
 */

import type { CustomArrayDict } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  CachedMetadata,
  Reference,
  TAbstractFile
} from 'obsidian';

import {
  CustomArrayDictImpl,
  isFrontmatterLinkCache,
  isReferenceCache,
  parentFolderPath
} from '@obsidian-typings/obsidian-public-latest/implementations';

import type { RetryOptions } from '../async.ts';
import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';
import type { PathOrFile } from './file-system.ts';
import type { CombinedFrontmatter } from './frontmatter.ts';
import type {
  ParseLinkFrontmatterReference,
  ParseLinkFrontmatterReferenceWithOffsets,
  ParseLinkReference
} from './parse-link.ts';

import { CallbackDisposable } from '../disposable.ts';
import { getNestedPropertyValue } from '../object-utils.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { strictProxy } from '../strict-proxy.ts';
import { ensureNonNullable } from '../type-guards.ts';
import { retryWithTimeoutNotice } from './async-with-notice.ts';
import {
  getFile,
  getFileOrNull,
  getFolder,
  getPath,
  isFile
} from './file-system.ts';
import {
  isFrontmatterLinkCacheWithOffsets,
  toFrontmatterLinkCacheWithOffsets
} from './frontmatter-link-cache-with-offsets.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { t } from './i18n/i18n.ts';
import {
  parseFrontmatterLinks,
  parseLinks,
  toParseLinkReference
} from './parse-link.ts';
import { sortReferences } from './reference.ts';
import {
  readSafe,
  saveNote
} from './vault.ts';

/**
 * A parsing feature that was applied when computing a {@link CachedMetadataEx}.
 */
export enum CachedMetadataExFeature {
  /**
   * The external links parsed from the note content body.
   */
  ExternalLinks = 'ExternalLinks',

  /**
   * The external links parsed from single-link note frontmatter values.
   */
  FrontmatterExternalLinks = 'FrontmatterExternalLinks',

  /**
   * The external links parsed from multi-link note frontmatter values.
   */
  MultiValueFrontmatterExternalLinks = 'MultiValueFrontmatterExternalLinks',

  /**
   * The internal links parsed from multi-link note frontmatter values, which Obsidian does not natively cache.
   */
  MultiValueFrontmatterLinks = 'MultiValueFrontmatterLinks',

  /**
   * Obsidian's native metadata parsing (internal links, embeds, frontmatter links).
   */
  Native = 'Native'
}

/**
 * An extended {@link CachedMetadata} that records which parsing {@link CachedMetadataExFeature}s were
 * applied (via {@link CachedMetadataEx.features}) and carries the resulting external links. Each links
 * array is populated only when its corresponding feature is present in {@link CachedMetadataEx.features}.
 */
export interface CachedMetadataEx extends CachedMetadata {
  /**
   * The external links parsed from the note content body. Populated only when
   * {@link CachedMetadataExFeature.ExternalLinks} is applied.
   */
  externalLinks?: ParseLinkReference[];

  /**
   * The parsing features that were applied when computing this cache.
   */
  readonly features: CachedMetadataExFeature[];

  /**
   * The external links parsed from single-link (single-value) note frontmatter values. Populated only
   * when {@link CachedMetadataExFeature.FrontmatterExternalLinks} is applied.
   */
  frontmatterExternalLinks?: ParseLinkFrontmatterReference[];

  /**
   * The external links parsed from multi-link (multi-value) note frontmatter values. Populated only when
   * {@link CachedMetadataExFeature.MultiValueFrontmatterExternalLinks} is applied.
   */
  multiValueFrontmatterExternalLinks?: ParseLinkFrontmatterReferenceWithOffsets[];

  /**
   * The internal links parsed from multi-link (multi-value) note frontmatter values. Populated only when
   * {@link CachedMetadataExFeature.MultiValueFrontmatterLinks} is applied.
   */
  multiValueFrontmatterLinks?: ParseLinkFrontmatterReferenceWithOffsets[];
}

/**
 * Options for {@link getBacklinksForFileSafe}.
 */
export interface GetBacklinksForFileSafeOptions extends RetryOptions {
  /**
   * Whether to show a timeout notice.
   *
   * @default `true`
   */
  readonly shouldShowTimeoutNotice?: boolean;
}

/**
 * Parameters for {@link getBacklinksForFileSafe}.
 */
export interface GetBacklinksForFileSafeParams extends GetBacklinksForFileSafeOptions {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The path or file object.
   */
  readonly pathOrFile: PathOrFile;
}

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
 * Params for {@link getLinks}.
 */
export interface GetLinksParams {
  /**
   * The cached metadata to retrieve the links from.
   */
  readonly cache: CachedMetadata;

  /**
   * Whether to include the embeds (`cache.embeds`).
   *
   * @default `true`
   */
  readonly shouldIncludeEmbeds?: boolean;

  /**
   * Whether to include the external links parsed from the note body. Requires the cache to be a
   * {@link CachedMetadataEx}.
   *
   * @default `false`
   */
  readonly shouldIncludeExternalLinks?: boolean;

  /**
   * Whether to include the external links parsed from single-link (single-value) note frontmatter
   * values. Requires the cache to be a {@link CachedMetadataEx}.
   *
   * @default `false`
   */
  readonly shouldIncludeFrontmatterExternalLinks?: boolean;

  /**
   * Whether to include the frontmatter links (`cache.frontmatterLinks`).
   *
   * @default `true`
   */
  readonly shouldIncludeFrontmatterLinks?: boolean;

  /**
   * Whether to include the external links parsed from multi-link (multi-value) note frontmatter values,
   * i.e. the offset-carrying frontmatter external links (narrowed via
   * {@link isFrontmatterLinkCacheWithOffsets}). Requires the cache to be a {@link CachedMetadataEx}.
   *
   * @default `false`
   */
  readonly shouldIncludeMultiValueFrontmatterExternalLinks?: boolean;

  /**
   * Whether to include the internal links parsed from multi-link (multi-value) note frontmatter values.
   * Requires the cache to be a {@link CachedMetadataEx}.
   *
   * @default `false`
   */
  readonly shouldIncludeMultiValueFrontmatterLinks?: boolean;

  /**
   * Whether to include the reference links (`cache.links`).
   *
   * @default `true`
   */
  readonly shouldIncludeReferences?: boolean;
}

/**
 * Options for the parsing performed by {@link getCacheSafe} and {@link parseMetadata} beyond Obsidian's
 * native metadata parsing. Each option is opt-in; enabling it adds the corresponding
 * {@link CachedMetadataExFeature} and populates the matching links array.
 */
export interface ParseCacheOptions {
  /**
   * Whether to parse the external links from the note content body.
   *
   * @default `false`
   */
  readonly shouldParseExternalLinks?: boolean;

  /**
   * Whether to parse the external links from single-link (single-value) note frontmatter values.
   *
   * @default `false`
   */
  readonly shouldParseFrontmatterExternalLinks?: boolean;

  /**
   * Whether to parse the external links from multi-link (multi-value) note frontmatter values.
   *
   * @default `false`
   */
  readonly shouldParseMultiValueFrontmatterExternalLinks?: boolean;

  /**
   * Whether to parse the internal links from multi-link (multi-value) note frontmatter values.
   *
   * @default `false`
   */
  readonly shouldParseMultiValueFrontmatterLinks?: boolean;
}

/**
 * Options for {@link parseMetadata}.
 */
export type ParseMetadataOptions = ParseCacheOptions;

/**
 * Parameters for {@link registerFileCacheForNonExistingFile}.
 */
export interface RegisterFileCacheForNonExistingFileParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The file cache to register.
   */
  readonly cache: CachedMetadata;

  /**
   * The path or file to register the file cache for.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * A selector for a feature-gated link category in {@link getLinks}.
 */
interface FeatureLinkSelector {
  /**
   * A human-readable description of the link category, used in error messages.
   */
  readonly description: string;

  /**
   * The feature that must be present in the cache for this category to be available.
   */
  readonly feature: CachedMetadataExFeature;

  /**
   * Selects the links for this category from the cache.
   */
  select(this: void, cache: CachedMetadataEx): Reference[] | undefined;

  /**
   * Whether to include this category.
   */
  readonly shouldInclude: boolean;
}

/**
 * Params for {@link toParsedCachedMetadataEx}.
 */
interface ToParsedCachedMetadataExParams {
  /**
   * The plain cached metadata to wrap.
   */
  readonly cache: CachedMetadata;

  /**
   * The note content the offsets index into, used for body external-link parsing.
   */
  readonly content: string;

  /**
   * The parse options controlling which links to parse.
   */
  readonly options: ParseCacheOptions;
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
 * Retrieves the backlinks for a file or path.
 * NOTE: The file may be non-existent.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file object.
 * @returns The backlinks for the file.
 */
export function getBacklinksForFileOrPath(app: App, pathOrFile: PathOrFile): CustomArrayDict<Reference> {
  const file = getFile({ app, pathOrFile, shouldIncludeNonExisting: true });
  using _registration = registerFiles(app, [file]);
  return app.metadataCache.getBacklinksForFile(file);
}

/**
 * Retrieves the backlinks for a file safely.
 *
 * @param params - The parameters for retrieving the backlinks.
 * @returns A {@link Promise} that resolves to an array dictionary of backlinks.
 */
export async function getBacklinksForFileSafe(params: GetBacklinksForFileSafeParams): Promise<CustomArrayDict<Reference>> {
  const { app, pathOrFile, ...options } = params;
  const safeOverload = (app.metadataCache.getBacklinksForFile as Partial<GetBacklinksForFileSafeWrapper>).safe;
  if (safeOverload) {
    return safeOverload(pathOrFile);
  }
  let backlinks: CustomArrayDict<Reference> = new CustomArrayDictImpl<Reference>();
  await retryWithTimeoutNotice({
    async operationFn(abortSignal) {
      abortSignal.throwIfAborted();
      const file = getFile({ app, pathOrFile });
      await ensureMetadataCacheReady(app);
      abortSignal.throwIfAborted();
      backlinks = getBacklinksForFileOrPath(app, file);
      for (const notePath of backlinks.keys()) {
        abortSignal.throwIfAborted();
        const note = getFileOrNull({ app, pathOrFile: notePath });
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
    operationName: t(($) => $.obsidianDevUtils.metadataCache.getBacklinksForFilePath, { filePath: getPath(app, pathOrFile) }),
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
    retryOptions: options,
    shouldShowTimeoutNotice: options.shouldShowTimeoutNotice ?? true
  });

  return backlinks;
}

/**
 * Retrieves the cached metadata for a given file or path.
 *
 * @param app - The Obsidian app instance.
 * @param fileOrPath - The file or path to retrieve the metadata for.
 * @returns The cached metadata for the file, or `null` if it doesn't exist.
 */
export async function getCacheSafe(app: App, fileOrPath: PathOrFile): Promise<CachedMetadataEx | null> {
  const file = getFileOrNull({ app, pathOrFile: fileOrPath });

  try {
    if (!file) {
      return null;
    }

    if (file.deleted) {
      return toNativeCachedMetadataEx(app.metadataCache.getFileCache(file));
    }

    await saveNote(app, file);

    const fileCacheEntry = app.metadataCache.fileCache[file.path];
    const isUpToDate = fileCacheEntry?.mtime === file.stat.mtime
      && fileCacheEntry.size === file.stat.size
      && app.metadataCache.metadataCache[fileCacheEntry.hash];
    if (!isUpToDate) {
      await app.metadataCache.computeFileMetadataAsync(file);
      await ensureMetadataCacheReady(app);
    }
    return toNativeCachedMetadataEx(app.metadataCache.getFileCache(file));
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
 * Retrieves the selected links from the provided cache.
 *
 * @param params - The parameters for retrieving the links.
 * @returns An array of references representing the selected links.
 */
export function getLinks(params: GetLinksParams): Reference[] {
  const {
    cache,
    shouldIncludeEmbeds = true,
    shouldIncludeExternalLinks = false,
    shouldIncludeFrontmatterExternalLinks = false,
    shouldIncludeFrontmatterLinks = true,
    shouldIncludeMultiValueFrontmatterExternalLinks = false,
    shouldIncludeMultiValueFrontmatterLinks = false,
    shouldIncludeReferences = true
  } = params;

  let links: Reference[] = [];

  if (shouldIncludeReferences && cache.links) {
    links.push(...cache.links);
  }

  if (shouldIncludeEmbeds && cache.embeds) {
    links.push(...cache.embeds);
  }

  if (shouldIncludeFrontmatterLinks && cache.frontmatterLinks) {
    links.push(...cache.frontmatterLinks);
  }

  const featureLinkSelectors: FeatureLinkSelector[] = [
    {
      description: 'body external links',
      feature: CachedMetadataExFeature.ExternalLinks,
      select: (cacheEx) => cacheEx.externalLinks,
      shouldInclude: shouldIncludeExternalLinks
    },
    {
      description: 'frontmatter external links',
      feature: CachedMetadataExFeature.FrontmatterExternalLinks,
      select: (cacheEx) => cacheEx.frontmatterExternalLinks,
      shouldInclude: shouldIncludeFrontmatterExternalLinks
    },
    {
      description: 'multi-value frontmatter external links',
      feature: CachedMetadataExFeature.MultiValueFrontmatterExternalLinks,
      select: (cacheEx) => cacheEx.multiValueFrontmatterExternalLinks,
      shouldInclude: shouldIncludeMultiValueFrontmatterExternalLinks
    },
    {
      description: 'multi-value frontmatter links',
      feature: CachedMetadataExFeature.MultiValueFrontmatterLinks,
      select: (cacheEx) => cacheEx.multiValueFrontmatterLinks,
      shouldInclude: shouldIncludeMultiValueFrontmatterLinks
    }
  ];

  for (const featureLinkSelector of featureLinkSelectors) {
    if (!featureLinkSelector.shouldInclude) {
      continue;
    }

    if (!isCachedMetadataEx(cache) || !cache.features.includes(featureLinkSelector.feature)) {
      throw new Error(`Cannot include ${featureLinkSelector.description}: the cache was not computed with the ${featureLinkSelector.feature} feature.`);
    }

    links.push(...ensureNonNullable(featureLinkSelector.select(cache)));
  }

  sortReferences(links);

  // BUG: https://forum.obsidian.md/t/bug-duplicated-links-in-metadatacache-inside-footnotes/85551
  links = links.filter((link, index) => {
    if (index === 0) {
      return true;
    }

    const previousLink = ensureNonNullable(links[index - 1]);

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
 * Determines whether a cache is a {@link CachedMetadataEx} (i.e. it was computed with external-link
 * parsing enabled).
 *
 * @param cache - The cache to check.
 * @returns `true` if the cache is a {@link CachedMetadataEx}, otherwise `false`.
 */
export function isCachedMetadataEx(cache: CachedMetadata): cache is CachedMetadataEx {
  return 'features' in cache;
}

/**
 * Parses the metadata for a given string.
 *
 * @param app - The Obsidian app instance.
 * @param str - The string to parse the metadata for.
 * @param options - The parse options controlling which additional links to parse.
 * @returns The parsed metadata.
 */
export async function parseMetadata(app: App, str: string, options: ParseMetadataOptions = {}): Promise<CachedMetadataEx> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(str).buffer;
  const cache = await app.metadataCache.computeMetadataAsync(buffer) ?? {};
  return toParsedCachedMetadataEx({ cache, content: str, options });
}

/**
 * Registers the file cache for a non-existing file.
 *
 * @param params - The parameters for registering the file cache.
 * @returns A {@link Disposable} that unregisters the file cache when disposed, for use with `using`.
 */
export function registerFileCacheForNonExistingFile(params: RegisterFileCacheForNonExistingFileParams): Disposable {
  const { app, cache, pathOrFile } = params;
  const file = getFile({ app, pathOrFile, shouldIncludeNonExisting: true });
  if (!file.deleted) {
    throw new Error('File is existing');
  }

  app.metadataCache.fileCache[file.path] = {
    hash: file.path,
    mtime: 0,
    size: 0
  };

  app.metadataCache.metadataCache[file.path] = cache;

  return new CallbackDisposable({
    callback: (): void => {
      unregisterFileCacheForNonExistingFile(app, file);
    }
  });
}

/**
 * Registers files in the Obsidian app.
 *
 * @param app - The Obsidian app instance.
 * @param files - The files to register.
 * @returns A {@link Disposable} that unregisters the files when disposed, for use with `using`.
 */
export function registerFiles(app: App, files: TAbstractFile[]): Disposable {
  const registeredFilesCounts = getRegisteredFilesCounts();

  for (let file of files) {
    while (file.deleted) {
      let count = registeredFilesCounts.get(file.path) ?? 0;
      count++;
      registeredFilesCounts.set(file.path, count);

      app.vault.fileMap[file.path] = file;

      if (isFile(file)) {
        app.metadataCache.uniqueFileLookup.add(file.name.toLowerCase(), file);
      }

      file = getFolder({
        app,
        pathOrFolder: parentFolderPath(file.path),
        shouldIncludeNonExisting: true
      });
    }
  }

  return new CallbackDisposable({
    callback: (): void => {
      unregisterFiles(app, files);
    }
  });
}

/**
 * Unregisters the file cache for a non-existing file.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file to unregister the file cache for.
 */
export function unregisterFileCacheForNonExistingFile(app: App, pathOrFile: PathOrFile): void {
  const file = getFile({ app, pathOrFile, shouldIncludeNonExisting: true });
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
  const registeredFilesCounts = getRegisteredFilesCounts();

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

      file = getFolder({
        app,
        pathOrFolder: parentFolderPath(file.path),
        shouldIncludeNonExisting: true
      });
    }
  }
}

function getRegisteredFilesCounts(): Map<string, number> {
  return getObsidianDevUtilsState('registeredFilesCounts', new Map<string, number>()).value;
}

function parseExternalBodyLinks(content: string, cache: CachedMetadata): ParseLinkReference[] {
  const frontmatterEndOffset = cache.frontmatterPosition?.end.offset ?? 0;
  return parseLinks(content)
    .filter((parseLinkResult) => parseLinkResult.isExternal && parseLinkResult.startOffset >= frontmatterEndOffset)
    .map((parseLinkResult) => toParseLinkReference({ content, parseLinkResult }));
}

function toNativeCachedMetadataEx(cache: CachedMetadata | null): CachedMetadataEx | null {
  if (cache === null) {
    return null;
  }

  return {
    ...cache,
    features: [CachedMetadataExFeature.Native]
  };
}

function toParsedCachedMetadataEx(params: ToParsedCachedMetadataExParams): CachedMetadataEx {
  const { cache, content, options } = params;
  const features: CachedMetadataExFeature[] = [CachedMetadataExFeature.Native];
  const result: CachedMetadataEx = { ...cache, features };

  if (options.shouldParseExternalLinks) {
    result.externalLinks = parseExternalBodyLinks(content, cache);
    features.push(CachedMetadataExFeature.ExternalLinks);
  }

  if (
    options.shouldParseFrontmatterExternalLinks
    || options.shouldParseMultiValueFrontmatterExternalLinks
    || options.shouldParseMultiValueFrontmatterLinks
  ) {
    const frontmatterLinks = parseFrontmatterLinks(cache.frontmatter);

    if (options.shouldParseFrontmatterExternalLinks) {
      result.frontmatterExternalLinks = frontmatterLinks.frontmatterExternalLinks;
      features.push(CachedMetadataExFeature.FrontmatterExternalLinks);
    }

    if (options.shouldParseMultiValueFrontmatterExternalLinks) {
      result.multiValueFrontmatterExternalLinks = frontmatterLinks.multiValueFrontmatterExternalLinks;
      features.push(CachedMetadataExFeature.MultiValueFrontmatterExternalLinks);
    }

    if (options.shouldParseMultiValueFrontmatterLinks) {
      result.multiValueFrontmatterLinks = frontmatterLinks.multiValueFrontmatterLinks;
      features.push(CachedMetadataExFeature.MultiValueFrontmatterLinks);
    }
  }

  return result;
}
