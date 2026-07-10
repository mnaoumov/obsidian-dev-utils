/**
 * @file
 *
 * This module provides utilities for handling and updating links within Obsidian vaults. It includes
 * functions to split paths, update links in files, and generate markdown links with various options.
 */

import type {
  App,
  CachedMetadata,
  Reference,
  TFile
} from 'obsidian';
import type { Promisable } from 'type-fest';

import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  normalizePath,
  parseLinktext
} from 'obsidian';

import type { GenericObject } from '../type-guards.ts';
import type { MaybeReturn } from '../type.ts';
import type { FileChange } from './file-change.ts';
import type {
  GetFileParams,
  PathOrFile
} from './file-system.ts';
import type { ProcessOptions } from './vault.ts';

import { abortSignalNever } from '../abort-controller.ts';
import { normalizeOptionalProperties } from '../object-utils.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import {
  basename,
  dirname,
  extname,
  join,
  relative
} from '../path.ts';
import {
  normalize,
  replaceAll,
  trimEnd
} from '../string.ts';
import {
  assertNever,
  assertNonNullable,
  ensureNonNullable
} from '../type-guards.ts';
import { normalizeFileUrl } from '../url.ts';
import {
  applyContentChanges,
  applyFileChanges,
  isCanvasChange,
  isContentChange
} from './file-change.ts';
import {
  getFile,
  getPath,
  isCanvasFile,
  isMarkdownFile,
  MARKDOWN_FILE_EXTENSION
} from './file-system.ts';
import {
  getBacklinksForFileSafe,
  getCacheSafe,
  getLinks,
  parseMetadata,
  registerFiles
} from './metadata-cache.ts';
import {
  getNewLinkFormat,
  shouldUseWikilinks
} from './obsidian-settings.ts';
import {
  encodeUrl,
  escapeAlias,
  isParseLinkReference,
  parseLink
} from './parse-link.ts';
import {
  isCanvasFileNodeReference,
  referenceToFileChange
} from './reference.ts';

const ESCAPED_WIKILINK_DIVIDER = '\\|';

/**
 * Regular expression for unescaped pipes.
 */
const UNESCAPED_WIKILINK_DIVIDER_REGEXP = /(?<!\\)\|/g;

/**
 * A style of the link path.
 */
export enum LinkPathStyle {
  /**
   * Use the absolute path in the vault.
   *
   * @example `[[path/from/the/vault/root/target]]`
   */
  AbsolutePathInVault = 'AbsolutePathInVault',

  /**
   * Use the default link path style defined in Obsidian settings.
   */
  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  /**
   * Use the relative path to the source.
   *
   * @example `[[../../relative/path/to/target]]`
   */
  RelativePathToTheSource = 'RelativePathToTheSource',

  /**
   * Use the shortest path when possible.
   *
   * @example `[[shortest-path-to-target]]`
   */
  ShortestPathWhenPossible = 'ShortestPathWhenPossible'
}

/**
 * A style of the link.
 */
export enum LinkStyle {
  /**
   * Force the link to be in markdown format.
   *
   * @example `[alias](path/to/target.md)`
   */
  Markdown = 'Markdown',

  /**
   * Use the default link style defined in Obsidian settings.
   */
  ObsidianSettingsDefault = 'ObsidianSettingsDefault',

  /**
   * Preserve the existing link style.
   */
  PreserveExisting = 'PreserveExisting',

  /**
   * Force the link to be in wikilink format.
   *
   * @example `[[path/to/target]]`
   * @example `[[path/to/target|alias]]`
   */
  Wikilink = 'Wikilink'
}

enum FinalLinkPathStyle {
  AbsolutePathInVault = 'AbsolutePathInVault',
  RelativePathToTheSource = 'RelativePathToTheNote',
  ShortestPathWhenPossible = 'ShortestPathWhenPossible'
}

/**
 * Params for {@link convertLink}.
 */
export interface ConvertLinkParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A reference for the link.
   */
  readonly link: Reference;

  /**
   * A style of the link.
   */
  readonly linkStyle?: LinkStyle;

  /**
   * A source file containing the link.
   */
  readonly newSourcePathOrFile: PathOrFile;

  /**
   * An old path of the link.
   */
  readonly oldSourcePathOrFile?: PathOrFile;

  /**
   * Whether to update file name alias.
   *
   * @default `true`
   */
  readonly shouldUpdateFileNameAlias?: boolean;
}

/**
 * Options for {@link editBacklinks}.
 */
export type EditBacklinksOptions = ProcessOptions;

/**
 * Parameters for {@link editBacklinks}.
 */
export interface EditBacklinksParams extends EditBacklinksOptions {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The function that converts each link.
   */
  linkConverter(this: void, link: Reference): Promisable<MaybeReturn<string>>;

  /**
   * The path or file to edit the backlinks for.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * Parameters for {@link editLinksInContent}.
 */
export interface EditLinksInContentParams {
  /**
   * The abort signal to control the execution of the function.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The content to edit the links in.
   */
  readonly content: string;

  /**
   * The function that converts each link.
   */
  linkConverter(this: void, link: Reference): Promisable<MaybeReturn<string>>;

  /**
   * Whether to also edit external links parsed from the note body. When `true`, the converter also
   * receives references for external links.
   *
   * @default `false`
   */
  readonly shouldEditExternalLinks?: boolean;
}

/**
 * Options for {@link editLinks}.
 */
export type EditLinksOptions = ProcessOptions;

/**
 * Parameters for {@link editLinks}.
 */
export interface EditLinksParams extends EditLinksOptions {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The function that converts each link.
   */
  linkConverter(this: void, link: Reference): Promisable<MaybeReturn<string>>;

  /**
   * The path or file to edit the links for.
   */
  readonly pathOrFile: PathOrFile;

  /**
   * Whether to also edit external links parsed from the note body. When `true`, the converter also
   * receives references for external links.
   *
   * @default `false`
   */
  readonly shouldEditExternalLinks?: boolean;
}

/**
 * Parameters for {@link extractLinkFile}.
 */
export interface ExtractLinkFileParams {
  /**
   * The Obsidian application instance.
   */
  readonly app: App;

  /**
   * The reference cache for the link.
   */
  readonly link: Reference;

  /**
   * Whether to allow non-existing files.
   *
   * @default `false`
   */
  readonly shouldAllowNonExistingFile?: boolean;

  /**
   * The source path or file.
   */
  readonly sourcePathOrFile: PathOrFile;
}

/**
 * Params for {@link generateMarkdownLink}.
 */
export interface GenerateMarkdownLinkParams {
  /**
   * An alias for the link.
   *
   * @example `[[alias|link]]`
   * @example `[alias](link.md)`
   */
  readonly alias?: string;

  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * Indicates if the link should be embedded. If not provided, it will be inferred based on the file type.
   *
   * If `true`: `![[target]]`.
   *
   * If `false`: `[[target]]`.
   */
  readonly isEmbed?: boolean;

  /**
   * Whether to allow an empty alias for embeds.
   *
   * Applicable only if the result link style is {@link LinkStyle.Markdown}.
   *
   * If `true`: `![](foo.png)`.
   *
   * If `false`: `![foo](foo.png)`.
   *
   * @default `true`
   */
  readonly isEmptyEmbedAliasAllowed?: boolean;

  /**
   * Whether to allow non-existing files.
   *
   * If `false` and {@link targetPathOrFile} is a non-existing file, an error will be thrown.
   *
   * @default `false`
   */
  readonly isNonExistingFileAllowed?: boolean;

  /**
   * Whether to allow a single subpath.
   *
   * Applicable only if {@link targetPathOrFile} and {@link sourcePathOrFile} are the same file.
   *
   * If `true`: `[[#subpath]]`.
   *
   * If `false`: `[[source#subpath]]`
   *
   * @default `true`
   */
  readonly isSingleSubpathAllowed?: boolean;

  /**
   * A style of the link path.
   */
  readonly linkPathStyle?: LinkPathStyle;

  /**
   * A style of the link.
   */
  readonly linkStyle?: LinkStyle;

  /**
   * An original link text.
   *
   * If provided, it will be used to infer the values of
   *
   * - {@link isEmbed}
   * - {@link linkStyle}
   * - {@link shouldUseAngleBrackets}
   * - {@link shouldUseLeadingDotForRelativePaths}
   * - {@link shouldUseLeadingSlashForAbsolutePaths}
   *
   * These inferred values will be overridden by corresponding settings if specified.
   */
  readonly originalLink?: string;

  /**
   * Whether to escape the alias.
   *
   * Applicable only if the result link style is {@link LinkStyle.Markdown}.
   *
   * If `true`: `[\*\*alias\*\*](link.md)`.
   *
   * If `false`: `[**alias**](link.md)`.
   *
   * @default `false`
   */
  readonly shouldEscapeAlias?: boolean;

  /**
   * Whether to include the attachment extension in the embed alias.
   *
   * Applicable only if {@link isEmptyEmbedAliasAllowed} is `false`.
   *
   * If `true`: `[foo.png](foo.png)`.
   *
   * If `false`: `[foo](foo.png)`.
   *
   * @default `false`
   */
  readonly shouldIncludeAttachmentExtensionToEmbedAlias?: boolean;

  /**
   * Indicates if the link should use angle brackets.
   *
   * Applicable only if {@link linkStyle} is {@link LinkStyle.Markdown}.
   *
   * If `true`: `[alias](<path with spaces.md>)`.
   *
   * If `false`: `[alias](path%20with%20spaces.md)`.
   *
   * @default `false`
   */
  readonly shouldUseAngleBrackets?: boolean;

  /**
   * Indicates if the link should use a leading dot.
   *
   * Applicable only if {@link linkPathStyle} is {@link LinkPathStyle.RelativePathToSource}.
   *
   * If `true`: `[[./relative/path/to/target]]`
   *
   * If `false`: `[[relative/path/to/target]]`
   *
   * @default `false`
   */
  readonly shouldUseLeadingDotForRelativePaths?: boolean;

  /**
   * Indicates if the link should use a leading slash.
   *
   * Applicable only if {@link linkPathStyle} is {@link LinkPathStyle.AbsolutePathInVault}.
   *
   * If `true`: `[[/absolute/path/to/target]]`
   *
   * If `false`: `[[absolute/path/to/target]]`
   *
   * @default `false`
   */
  readonly shouldUseLeadingSlashForAbsolutePaths?: boolean;

  /**
   * A source path of the link.
   */
  readonly sourcePathOrFile: PathOrFile;

  /**
   * A subpath of the link.
   *
   * Should be empty or start with `#`.
   *
   * @example `[[link-with-empty-subpath]]`
   * @example `[[link-with-subpath#subpath]]`
   * @example `[[link-with-subpath#subpath#nested-subpath]]`
   * @default `''`
   */
  readonly subpath?: string;

  /**
   * A target path or file.
   */
  readonly targetPathOrFile: PathOrFile;
}

/**
 * Params for {@link generateRawMarkdownLink}.
 */
export interface GenerateRawMarkdownLinkParams {
  /**
   * An alias of the link. Defaults to `undefined`.
   */
  readonly alias?: string | undefined;

  /**
   * Whether the link should be an embed link.
   *
   * @default `false`
   */
  readonly isEmbed?: boolean;

  /**
   * Whether the link should be a wikilink.
   */
  readonly isWikilink: boolean;

  /**
   * Whether to escape the alias. Applicable only if {@link isWikilink} is `false`.
   *
   * @default `false`
   */
  readonly shouldEscapeAlias?: boolean;

  /**
   * Whether to use angle brackets. Applicable only if {@link isWikilink} is `false`.
   *
   * @default `false`
   */
  readonly shouldUseAngleBrackets?: boolean;

  /**
   * A title of the link.
   */
  readonly title?: string;

  /**
   * An URL of the link.
   */
  readonly url: string;
}

/**
 * Params for {@link shouldResetAlias}.
 */
export interface ShouldResetAliasParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A display text of the link.
   */
  readonly displayText: string | undefined;

  /**
   * Indicates if the link is a wikilink.
   */
  readonly isWikilink?: boolean;

  /**
   * A source path of the link.
   */
  readonly newSourcePathOrFile: PathOrFile;

  /**
   * An old source file containing the link.
   */
  readonly oldSourcePathOrFile?: PathOrFile;

  /**
   * An old target path of the link.
   */
  readonly oldTargetPath: PathOrFile;

  /**
   * A target path or file.
   */
  readonly targetPathOrFile: PathOrFile;
}

/**
 * Splits a link into its link path and subpath.
 */
export interface SplitSubpathResult {
  /**
   * A link path.
   */
  readonly linkPath: string;

  /**
   * A subpath.
   */
  readonly subpath: string;
}

/**
 * Params for {@link updateFileUrlLinksInContent}.
 */
export interface UpdateFileUrlLinksInContentParams {
  /**
   * The abort signal to control the execution of the function.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * The content to normalize the `file://` links in.
   */
  readonly content: string;

  /**
   * Whether to emit the normalized links with angle brackets and raw spaces instead of `%20`-encoding.
   *
   * @default `false`
   */
  readonly shouldUseAngleBrackets?: boolean;
}

/**
 * Params for {@link updateFileUrlLinksInFile}.
 */
export interface UpdateFileUrlLinksInFileParams extends ProcessOptions {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * The path or file to normalize the `file://` links in.
   */
  readonly pathOrFile: PathOrFile;

  /**
   * Whether to emit the normalized links with angle brackets and raw spaces instead of `%20`-encoding.
   *
   * @default `false`
   */
  readonly shouldUseAngleBrackets?: boolean;
}

/**
 * Params for {@link updateLink}.
 */
export interface UpdateLinkParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A reference for the link.
   */
  readonly link: Reference;

  /**
   * Whether to force markdown links.
   */
  readonly linkStyle?: LinkStyle;

  /**
   * A source file containing the link.
   */
  readonly newSourcePathOrFile: PathOrFile;

  /**
   * A file associated with the link.
   */
  readonly newTargetPathOrFile: PathOrFile;

  /**
   * An old source file containing the link.
   */
  readonly oldSourcePathOrFile?: PathOrFile;

  /**
   * An old path of the file.
   */
  readonly oldTargetPathOrFile?: PathOrFile;

  /**
   * Whether to update file name alias.
   *
   * @default `true`
   */
  readonly shouldUpdateFileNameAlias?: boolean;
}

/**
 * Params for {@link updateLinksInFile}.
 */
export interface UpdateLinksInFileParams extends ProcessOptions {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A style of the link.
   */
  readonly linkStyle?: LinkStyle;

  /**
   * A file to update the links in.
   */
  readonly newSourcePathOrFile: PathOrFile;

  /**
   * An old path of the file.
   */
  readonly oldSourcePathOrFile?: PathOrFile;

  /**
   * Whether to update only embedded links.
   */
  readonly shouldUpdateEmbedOnlyLinks?: boolean;

  /**
   * Whether to update file name alias.
   *
   * @default `true`
   */
  readonly shouldUpdateFileNameAlias?: boolean;
}

/**
 * Parameters for {@link fixFrontmatterMarkdownLinksImpl}.
 */
interface FixFrontmatterMarkdownLinksImplParams {
  /**
   * The metadata cache to fix the frontmatter markdown links in.
   */
  readonly cache: CachedMetadata;

  /**
   * The key path of the current value within the frontmatter.
   */
  readonly key: string;

  /**
   * The current frontmatter value to inspect.
   */
  readonly value: unknown;
}

/**
 * Params for {@link generateLinkText}.
 */
interface GenerateLinkTextParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A configuration of the link.
   */
  readonly config: LinkConfig;

  /**
   * A source path of the link.
   */
  readonly sourcePath: string;

  /**
   * A subpath of the link.
   */
  readonly subpath: string;

  /**
   * A target file of the link.
   */
  readonly targetFile: TFile;
}

/**
 * Params for {@link generateMarkdownStyleLink}.
 */
interface GenerateMarkdownStyleLinkParams {
  /**
   * A configuration of the link.
   */
  readonly config: LinkConfig;

  /**
   * A text of the link.
   */
  readonly linkText: string;

  /**
   * The params for generating the markdown link.
   */
  readonly markdownLinkParams: GenerateMarkdownLinkParams;

  /**
   * A target file of the link.
   */
  readonly targetFile: TFile;
}

/**
 * Params for {@link generateWikiLink}.
 */
interface GenerateWikiLinkParams {
  /**
   * An alias of the link.
   */
  readonly alias: string | undefined;

  /**
   * Whether the link should be an embed link.
   */
  readonly isEmbed: boolean;

  /**
   * A text of the link.
   */
  readonly linkText: string;
}

/**
 * Params for {@link getFileChanges}.
 */
interface GetFileChangesParams {
  /**
   * An abort signal to control the execution of the function.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * A metadata cache to extract the links from.
   */
  readonly cache: CachedMetadata | null;

  /**
   * Whether the cache belongs to a canvas file.
   */
  readonly isCanvasFileCache: boolean;

  /**
   * A function that converts each link.
   */
  linkConverter(this: void, link: Reference, abortSignal: AbortSignal): Promisable<MaybeReturn<string>>;

  /**
   * Whether to include external links (parsed from the note body) in the changes.
   *
   * @default `false`
   */
  readonly shouldIncludeExternalLinks?: boolean;
}

interface LinkConfig {
  readonly isEmbed: boolean;
  readonly isSingleSubpathAllowed: boolean;
  readonly isWikilink: boolean;
  readonly linkPathStyle: FinalLinkPathStyle;
  readonly shouldUseAngleBrackets: boolean;
  readonly shouldUseLeadingDotForRelativePaths: boolean;
  readonly shouldUseLeadingSlashForAbsolutePaths: boolean;
}

/**
 * Params for {@link shouldUseWikilinkStyle}.
 */
interface ShouldUseWikilinkStyleParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A style of the link.
   */
  readonly linkStyle?: LinkStyle;

  /**
   * An original link text.
   */
  readonly originalLink?: string;
}

interface TablePosition {
  end: number;
  start: number;
}

/**
 * Params for {@link updateLinksInContent}.
 */
interface UpdateLinksInContentParams {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A content to update the links in.
   */
  readonly content: string;

  /**
   * A style of the link.
   */
  readonly linkStyle?: LinkStyle;

  /**
   * A new source path or file.
   */
  readonly newSourcePathOrFile: PathOrFile;

  /**
   * An old source path or file.
   */
  readonly oldSourcePathOrFile?: PathOrFile;

  /**
   * Whether to update only embedded links.
   */
  readonly shouldUpdateEmbedOnlyLinks?: boolean;

  /**
   * Whether to update file name alias.
   *
   * @default `true`
   */
  readonly shouldUpdateFileNameAlias?: boolean;
}

/**
 * Converts a link to a new path.
 *
 * @param params - The parameters for converting the link.
 * @returns The converted link.
 */
export function convertLink(params: ConvertLinkParams): string {
  const targetFile = extractLinkFile({
    app: params.app,
    link: params.link,
    sourcePathOrFile: params.oldSourcePathOrFile ?? params.newSourcePathOrFile
  });
  if (!targetFile) {
    return params.link.original;
  }

  return updateLink(normalizeOptionalProperties<UpdateLinkParams>({
    app: params.app,
    link: params.link,
    linkStyle: params.linkStyle,
    newSourcePathOrFile: params.newSourcePathOrFile,
    newTargetPathOrFile: targetFile,
    oldSourcePathOrFile: params.oldSourcePathOrFile,
    shouldUpdateFileNameAlias: params.shouldUpdateFileNameAlias
  }));
}

/**
 * Edits the backlinks for a file or path.
 *
 * @param params - The parameters for editing the backlinks.
 * @returns A {@link Promise} that resolves when the backlinks have been edited.
 */
export async function editBacklinks(params: EditBacklinksParams): Promise<void> {
  const {
    app,
    linkConverter,
    pathOrFile,
    ...options
  } = params;
  const backlinks = await getBacklinksForFileSafe({ app, pathOrFile, ...options });
  for (const backlinkNotePath of backlinks.keys()) {
    const currentLinks = ensureNonNullable(backlinks.get(backlinkNotePath));
    const linkJsons = new Set<string>(currentLinks.map((link) => JSON.stringify(link)));
    await editLinks({
      app,
      linkConverter: (link) => {
        const linkJson = JSON.stringify(link);
        if (!linkJsons.has(linkJson)) {
          return;
        }

        return linkConverter(link);
      },
      pathOrFile: backlinkNotePath,
      ...options
    });
  }
}

/**
 * Edits the links for a file or path.
 *
 * @param params - The parameters for editing the links.
 * @returns A {@link Promise} that resolves when the links have been edited.
 */
export async function editLinks(params: EditLinksParams): Promise<void> {
  const {
    app,
    linkConverter,
    pathOrFile,
    shouldEditExternalLinks = false,
    ...options
  } = params;
  await applyFileChanges({
    app,
    changesProvider: async ({ abortSignal, content }) => {
      const cache = await getCacheSafe(app, pathOrFile, shouldEditExternalLinks ? { shouldParseExternalLinks: true } : {});
      abortSignal.throwIfAborted();
      const file = getFile({ app, pathOrFile });
      const cachedContent = await app.vault.cachedRead(file);
      abortSignal.throwIfAborted();
      if (content !== cachedContent) {
        return null;
      }

      return await getFileChanges({
        abortSignal,
        cache,
        isCanvasFileCache: isCanvasFile(pathOrFile),
        linkConverter,
        shouldIncludeExternalLinks: shouldEditExternalLinks
      });
    },
    pathOrFile,
    ...options
  });
}

/**
 * Edits the links in a content string.
 *
 * @param params - The parameters for editing the links in the content.
 * @returns The promise that resolves to the updated content.
 */
export async function editLinksInContent(params: EditLinksInContentParams): Promise<string> {
  const { app, content, linkConverter, shouldEditExternalLinks = false } = params;
  let { abortSignal } = params;
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();

  const newContent = await applyContentChanges({
    abortSignal,
    changesProvider: async () => {
      const cache = await parseMetadata(app, content, shouldEditExternalLinks ? { shouldParseExternalLinks: true } : {});
      abortSignal.throwIfAborted();
      const changes = await getFileChanges({
        abortSignal,
        cache,
        isCanvasFileCache: false,
        linkConverter,
        shouldIncludeExternalLinks: shouldEditExternalLinks
      });
      abortSignal.throwIfAborted();
      return changes;
    },
    content,
    path: ''
  });
  abortSignal.throwIfAborted();

  assertNonNullable(newContent, 'Failed to update links in content');

  return newContent;
}

/**
 * Extracts the file associated with a link.
 *
 * @param params - The parameters for extracting the link file.
 * @returns The file associated with the link, or `null` if not found.
 */
export function extractLinkFile(params: ExtractLinkFileParams): null | TFile {
  const {
    app,
    link,
    shouldAllowNonExistingFile = false,
    sourcePathOrFile
  } = params;
  const { linkPath } = splitSubpath(link.link);
  const sourcePath = getPath(app, sourcePathOrFile);
  const file = app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
  if (file) {
    return file;
  }

  if (!shouldAllowNonExistingFile) {
    return null;
  }

  if (linkPath.startsWith('/')) {
    return getFile({ app, pathOrFile: linkPath, shouldIncludeNonExisting: true });
  }

  const fullLinkPath = join(dirname(sourcePath), `./${linkPath}`);

  if (fullLinkPath.startsWith('../')) {
    return null;
  }

  return getFile({ app, pathOrFile: fullLinkPath, shouldIncludeNonExisting: true });
}

/**
 * Fixes the frontmatter markdown links in the provided metadata cache.
 *
 * @param cache - The metadata cache to fix the frontmatter markdown links in.
 * @returns Whether the frontmatter markdown links were fixed.
 */
export function fixFrontmatterMarkdownLinks(cache: CachedMetadata): boolean {
  return fixFrontmatterMarkdownLinksImpl({ cache, key: '', value: cache.frontmatter });
}

/**
 * Generates a markdown link based on the provided parameters.
 *
 * @param params - The parameters for generating the markdown link.
 * @returns The generated markdown link.
 */
export function generateMarkdownLink(params: GenerateMarkdownLinkParams): string {
  const { app } = params;

  const DEFAULT_PARAMS: Partial<GenerateMarkdownLinkParams> = {
    isEmptyEmbedAliasAllowed: true
  };

  const customDefaultParams = getGenerateMarkdownLinkDefaultParamsFns().map((defaultParamsFn) => defaultParamsFn());
  params = Object.assign({}, DEFAULT_PARAMS, ...customDefaultParams, params);
  const targetFile = getFile(normalizeOptionalProperties<GetFileParams>({ app, pathOrFile: params.targetPathOrFile, shouldIncludeNonExisting: params.isNonExistingFileAllowed }));

  using _registration = registerFiles(app, [targetFile]);
  return generateMarkdownLinkImpl(params);
}

/**
 * Generates a raw markdown link based on the provided params.
 *
 * @param params - The parameters for generating a raw markdown link.
 * @returns A raw markdown link.
 */
export function generateRawMarkdownLink(params: GenerateRawMarkdownLinkParams): string {
  const embedPrefix = params.isEmbed ? '!' : '';

  if (params.isWikilink) {
    const aliasPart = params.alias ? `|${params.alias}` : '';
    return `${embedPrefix}[[${params.url}${aliasPart}]]`;
  }

  const alias = params.alias ?? '';
  const shouldEscapeAlias = params.shouldEscapeAlias ?? false;
  const escapedAlias = shouldEscapeAlias ? escapeAlias(alias) : alias;

  const url = params.shouldUseAngleBrackets
    ? `<${params.url}>`
    : encodeUrl(params.url);

  const titlePart = params.title ? ` ${JSON.stringify(params.title)}` : '';

  return `${embedPrefix}[${escapedAlias}](${url}${titlePart})`;
}

/**
 * Returns the shared, mutable list of functions that provide default params for {@link generateMarkdownLink}.
 *
 * Each function is invoked on every {@link generateMarkdownLink} call and its result is merged into the params (later
 * registrations take precedence over the built-in defaults, but never over explicitly passed params). Register entries
 * by adding a `GenerateMarkdownLinkDefaultParamsComponent` to a component tree rather than mutating this list directly.
 *
 * @returns The mutable list of default-params functions.
 */
export function getGenerateMarkdownLinkDefaultParamsFns(): (() => Partial<GenerateMarkdownLinkParams>)[] {
  return getObsidianDevUtilsState<(() => Partial<GenerateMarkdownLinkParams>)[]>('generateMarkdownLinkDefaultParamsFns', []).value;
}

/**
 * Determines if the alias of a link should be reset.
 *
 * @param params - The parameters for determining if the alias should be reset.
 * @returns Whether the alias should be reset.
 */
export function shouldResetAlias(params: ShouldResetAliasParams): boolean {
  const {
    app,
    displayText,
    isWikilink,
    newSourcePathOrFile,
    oldSourcePathOrFile,
    oldTargetPath,
    targetPathOrFile
  } = params;
  if (isWikilink === false) {
    return false;
  }

  if (!displayText) {
    return true;
  }

  const targetFile = getFile({ app, pathOrFile: targetPathOrFile, shouldIncludeNonExisting: true });
  const newSourcePath = getPath(app, newSourcePathOrFile);
  const oldSourcePath = getPath(app, oldSourcePathOrFile ?? newSourcePathOrFile);
  const newSourceFolder = dirname(newSourcePath);
  const oldSourceFolder = dirname(oldSourcePath);
  const aliasesToReset = new Set<string>();

  for (const pathOrFile of [targetFile.path, oldTargetPath]) {
    if (!pathOrFile) {
      continue;
    }

    const path = getPath(app, pathOrFile);
    aliasesToReset.add(path);
    aliasesToReset.add(basename(path));
    aliasesToReset.add(relative(newSourceFolder, path));
    aliasesToReset.add(relative(oldSourceFolder, path));
  }

  for (const sourcePath of [oldSourcePath, newSourcePath]) {
    aliasesToReset.add(app.metadataCache.fileToLinktext(targetFile, sourcePath, false));
  }

  const cleanDisplayText = replaceAll({
    replacer: '',
    searchValue: /^\.\//g,
    str: normalizePath(ensureNonNullable(displayText.split(' > ')[0]))
  }).toLowerCase();

  for (const alias of aliasesToReset) {
    if (alias.toLowerCase() === cleanDisplayText) {
      return true;
    }

    const folder = dirname(alias);
    const base = basename(alias, extname(alias));
    if (join(folder, base).toLowerCase() === cleanDisplayText) {
      return true;
    }
  }

  return false;
}

/**
 * Splits a link into its link path and subpath.
 *
 * @param link - The link to split.
 * @returns An object containing the link path and subpath.
 */
export function splitSubpath(link: string): SplitSubpathResult {
  const parsed = parseLinktext(normalize(link));
  return {
    linkPath: parsed.path,
    subpath: parsed.subpath
  };
}

/**
 * Tests whether a link uses angle brackets, possibly embed:
 * `[title](<link>)`, `![title](<link>)`.
 *
 * @param link - Link to test
 * @returns Whether the link uses angle brackets
 */
export function testAngleBrackets(link: string): boolean {
  const parseLinkResult = parseLink(link);
  return parseLinkResult?.hasAngleBrackets ?? false;
}

/**
 * Tests whether a link is an embed link:
 * `![[link]]`, `![title](link)`.
 *
 * @param link - Link to test
 * @returns Whether the link is an embed link
 */
export function testEmbed(link: string): boolean {
  const parseLinkResult = parseLink(link);
  return parseLinkResult?.isEmbed ?? false;
}

/**
 * Tests whether a link has a leading dot, possibly embed:
 * `[[./link]]`, `[title](./link)`, `[title](<./link>)`,
 * `![[./link]]`, `![title](./link)`, `![title](<./link>)`.
 *
 * @param link - Link to test
 * @returns Whether the link has a leading dot
 */
export function testLeadingDot(link: string): boolean {
  const parseLinkResult = parseLink(link);
  return parseLinkResult?.url.startsWith('./') ?? false;
}

/**
 * Tests whether a link has a leading slash, possibly embed:
 * `[[/link]]`, `[title](/link)`, `[title](</link>)`,
 * `![[/link]]`, `![title](/link)`, `![title](</link>)`.
 *
 * @param link - Link to test
 * @returns Whether the link has a leading slash
 */
export function testLeadingSlash(link: string): boolean {
  const parseLinkResult = parseLink(link);
  return parseLinkResult?.url.startsWith('/') ?? false;
}

/**
 * Tests whether a link is a wikilink, possibly embed:
 * `[[link]]`, `![[link]]`.
 *
 * @param link - Link to test
 * @returns Whether the link is a wikilink
 */
export function testWikilink(link: string): boolean {
  const parseLinkResult = parseLink(link);
  return parseLinkResult?.isWikilink ?? false;
}

/**
 * Normalizes the `file://` links in a content string to a pretty form, converting backslashes to forward
 * slashes. Other links are left unchanged.
 *
 * @param params - The parameters for normalizing the links.
 * @returns A {@link Promise} that resolves to the content with normalized `file://` links.
 */
export async function updateFileUrlLinksInContent(params: UpdateFileUrlLinksInContentParams): Promise<string> {
  const { app, content, shouldUseAngleBrackets = false } = params;
  return await editLinksInContent(normalizeOptionalProperties<EditLinksInContentParams>({
    abortSignal: params.abortSignal,
    app,
    content,
    linkConverter: (link) => normalizeFileUrlLink(link, shouldUseAngleBrackets),
    shouldEditExternalLinks: true
  }));
}

/**
 * Normalizes the `file://` links in a file to a pretty form, converting backslashes to forward slashes.
 * Other links are left unchanged.
 *
 * @param params - The parameters for normalizing the links.
 * @returns A {@link Promise} that resolves when the links are normalized.
 */
export async function updateFileUrlLinksInFile(params: UpdateFileUrlLinksInFileParams): Promise<void> {
  const {
    app,
    pathOrFile,
    shouldUseAngleBrackets = false,
    ...options
  } = params;
  await editLinks({
    app,
    linkConverter: (link) => normalizeFileUrlLink(link, shouldUseAngleBrackets),
    pathOrFile,
    shouldEditExternalLinks: true,
    ...options
  });
}

/**
 * Updates a link based on the provided parameters.
 *
 * @param params - The parameters for updating the link.
 * @returns The updated link.
 */
export function updateLink(params: UpdateLinkParams): string {
  const {
    app,
    link,
    linkStyle,
    newSourcePathOrFile,
    newTargetPathOrFile,
    oldSourcePathOrFile,
    oldTargetPathOrFile,
    shouldUpdateFileNameAlias = true
  } = params;
  if (!newTargetPathOrFile) {
    return link.original;
  }
  const newTargetFile = getFile({ app, pathOrFile: newTargetPathOrFile, shouldIncludeNonExisting: true });
  const oldSourcePath = getPath(app, oldSourcePathOrFile ?? newSourcePathOrFile);
  const oldTargetPath = getPath(app, oldTargetPathOrFile ?? newTargetPathOrFile);
  const isWikilink = shouldUseWikilinkStyle(normalizeOptionalProperties<ShouldUseWikilinkStyleParams>({
    app,
    linkStyle,
    originalLink: link.original
  }));

  const { subpath } = splitSubpath(link.link);
  let shouldKeepAlias = !shouldUpdateFileNameAlias;

  if (isCanvasFile(newSourcePathOrFile)) {
    /* v8 ignore start -- Canvas file node reference branch is hard to reproduce in unit tests. */
    if (isCanvasFileNodeReference(link)) {
      return newTargetFile.path + subpath;
    }
    /* v8 ignore stop */
  }

  const parseLinkResult = parseLink(link.original);
  let alias: string | undefined;

  if (isWikilink && parseLinkResult?.alias) {
    alias = parseLinkResult.alias;
    shouldKeepAlias = true;
  }

  alias ??= shouldResetAlias(normalizeOptionalProperties<ShouldResetAliasParams>({
      app,
      displayText: link.displayText,
      isWikilink,
      newSourcePathOrFile,
      oldSourcePathOrFile,
      oldTargetPath,
      targetPathOrFile: newTargetFile
    }))
    ? undefined
    : parseLinkResult?.alias;

  if (!shouldKeepAlias) {
    /* v8 ignore start -- Alias matching branches are hard to reproduce in unit tests. */
    if (alias === basename(oldTargetPath, extname(oldTargetPath))) {
      alias = newTargetFile.basename;
    } else if (alias === basename(oldTargetPath)) {
      alias = newTargetFile.name;
    }
    /* v8 ignore stop */
  }

  const newLink = generateMarkdownLink(normalizeOptionalProperties<GenerateMarkdownLinkParams>({
    alias,
    app,
    isSingleSubpathAllowed: oldSourcePath === oldTargetPath && !!parseLinkResult?.alias,
    linkStyle,
    originalLink: link.original,
    sourcePathOrFile: newSourcePathOrFile,
    subpath,
    targetPathOrFile: newTargetFile
  }));
  return newLink;
}

/**
 * Updates the links in a content string based on the provided parameters.
 *
 * @param params - The parameters for updating the links.
 * @returns A {@link Promise} that resolves to the content with updated links.
 */
export async function updateLinksInContent(params: UpdateLinksInContentParams): Promise<string> {
  const {
    app,
    content,
    linkStyle,
    newSourcePathOrFile,
    oldSourcePathOrFile,
    shouldUpdateEmbedOnlyLinks,
    shouldUpdateFileNameAlias
  } = params;

  return await editLinksInContent({
    app,
    content,
    linkConverter: (link) => {
      const isEmbedLink = testEmbed(link.original);
      if (shouldUpdateEmbedOnlyLinks !== undefined && shouldUpdateEmbedOnlyLinks !== isEmbedLink) {
        return;
      }
      return convertLink(normalizeOptionalProperties<ConvertLinkParams>({
        app,
        link,
        linkStyle,
        newSourcePathOrFile,
        oldSourcePathOrFile,
        shouldUpdateFileNameAlias
      }));
    }
  });
}

/**
 * Updates the links in a file based on the provided parameters.
 *
 * @param params - The parameters for updating the links.
 * @returns A {@link Promise} that resolves when the links are updated.
 */
export async function updateLinksInFile(params: UpdateLinksInFileParams): Promise<void> {
  const {
    app,
    linkStyle,
    newSourcePathOrFile,
    oldSourcePathOrFile,
    shouldUpdateEmbedOnlyLinks,
    shouldUpdateFileNameAlias
  } = params;

  if (isCanvasFile(newSourcePathOrFile) && !app.internalPlugins.getEnabledPluginById(InternalPluginName.Canvas)) {
    return;
  }

  await editLinks({
    ...params,
    linkConverter: (link) => {
      const isEmbedLink = testEmbed(link.original);
      if (shouldUpdateEmbedOnlyLinks !== undefined && shouldUpdateEmbedOnlyLinks !== isEmbedLink) {
        return;
      }
      return convertLink(normalizeOptionalProperties<ConvertLinkParams>({
        app,
        link,
        linkStyle,
        newSourcePathOrFile,
        oldSourcePathOrFile,
        shouldUpdateFileNameAlias
      }));
    },
    pathOrFile: newSourcePathOrFile
  });
}

function fixFrontmatterMarkdownLinksImpl(params: FixFrontmatterMarkdownLinksImplParams): boolean {
  const {
    cache,
    key,
    value
  } = params;
  if (typeof value === 'string') {
    const parseLinkResult = parseLink(value);
    if (!parseLinkResult || parseLinkResult.isWikilink || parseLinkResult.isExternal) {
      return false;
    }

    cache.frontmatterLinks ??= [];
    let link = cache.frontmatterLinks.find((frontmatterLink) => frontmatterLink.key === key);

    if (!link) {
      link = {
        key,
        link: '',
        original: ''
      };
      cache.frontmatterLinks.push(link);
    }

    link.link = parseLinkResult.url;
    link.original = value;
    if (parseLinkResult.alias !== undefined) {
      link.displayText = parseLinkResult.alias;
    }

    return true;
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  let hasFrontmatterLinks = false;

  for (const [childKey, childValue] of Object.entries(value as GenericObject)) {
    const hasChildFrontmatterLinks = fixFrontmatterMarkdownLinksImpl({ cache, key: key ? `${key}.${childKey}` : childKey, value: childValue });
    hasFrontmatterLinks ||= hasChildFrontmatterLinks;
  }

  return hasFrontmatterLinks;
}

function generateLinkText(params: GenerateLinkTextParams): string {
  const { app, config, subpath, targetFile } = params;
  let { sourcePath } = params;
  if (sourcePath === '/') {
    sourcePath = '';
  }

  let linkText: string;

  if (targetFile.path === sourcePath && subpath && config.isSingleSubpathAllowed) {
    linkText = '';
  } else {
    /* v8 ignore start -- All branches covered but v8 reports switch as partial. */
    switch (config.linkPathStyle) {
      /* v8 ignore stop */
      case FinalLinkPathStyle.AbsolutePathInVault:
        linkText = targetFile.path;
        if (config.shouldUseLeadingSlashForAbsolutePaths && !linkText.startsWith('/')) {
          linkText = `/${linkText}`;
        }
        break;
      case FinalLinkPathStyle.RelativePathToTheSource:
        linkText = relative(dirname(sourcePath), targetFile.path);
        if (config.shouldUseLeadingDotForRelativePaths && !linkText.startsWith('.')) {
          linkText = `./${linkText}`;
        }
        break;
      case FinalLinkPathStyle.ShortestPathWhenPossible: {
        const shortestName = isMarkdownFile(targetFile) ? targetFile.basename : targetFile.name;
        const matchedFiles = app.metadataCache.getLinkpathDest(shortestName, sourcePath);
        linkText = matchedFiles.length === 1 && matchedFiles[0] === targetFile ? targetFile.name : targetFile.path;
        break;
      }
      /* v8 ignore start -- All valid FinalLinkPathStyle values are handled above. */
      default:
        assertNever(config.linkPathStyle);
        /* v8 ignore stop */
    }
  }

  linkText = config.isWikilink
    ? trimEnd({
      str: linkText,
      suffix: `.${MARKDOWN_FILE_EXTENSION}`
    })
    : linkText;
  linkText += subpath;

  return linkText;
}

function generateMarkdownLinkImpl(params: GenerateMarkdownLinkParams): string {
  const { app } = params;
  const targetFile = getFile(normalizeOptionalProperties<GetFileParams>({ app, pathOrFile: params.targetPathOrFile, shouldIncludeNonExisting: params.isNonExistingFileAllowed }));
  const sourcePath = getPath(app, params.sourcePathOrFile);
  const subpath = params.subpath ?? '';

  const linkConfig = getLinkConfig(params);
  const linkText = generateLinkText({
    app,
    config: linkConfig,
    sourcePath,
    subpath,
    targetFile
  });

  return linkConfig.isWikilink
    ? generateWikiLink({
      alias: params.alias,
      isEmbed: linkConfig.isEmbed,
      linkText
    })
    : generateMarkdownStyleLink({
      config: linkConfig,
      linkText,
      markdownLinkParams: params,
      targetFile
    });
}

function generateMarkdownStyleLink(params: GenerateMarkdownStyleLinkParams): string {
  const { config, linkText, markdownLinkParams, targetFile } = params;
  let alias = markdownLinkParams.alias ?? '';
  let shouldEscapeAlias = markdownLinkParams.shouldEscapeAlias ?? false;
  if (!alias && (isMarkdownFile(targetFile) || !markdownLinkParams.isEmptyEmbedAliasAllowed)) {
    alias = !markdownLinkParams.shouldIncludeAttachmentExtensionToEmbedAlias || isMarkdownFile(targetFile)
      ? targetFile.basename
      : targetFile.name;
    shouldEscapeAlias = true;
  }

  return generateRawMarkdownLink({
    alias,
    isEmbed: config.isEmbed,
    isWikilink: false,
    shouldEscapeAlias,
    shouldUseAngleBrackets: config.shouldUseAngleBrackets,
    url: linkText
  });
}

function generateWikiLink(params: GenerateWikiLinkParams): string {
  const { alias, isEmbed, linkText } = params;
  if (alias?.toLowerCase() === linkText.toLowerCase()) {
    return generateRawMarkdownLink({
      isEmbed,
      isWikilink: true,
      url: alias
    });
  }

  return generateRawMarkdownLink({
    alias,
    isEmbed,
    isWikilink: true,
    url: linkText
  });
}

async function getFileChanges(params: GetFileChangesParams): Promise<FileChange[]> {
  const { cache, isCanvasFileCache, linkConverter, shouldIncludeExternalLinks = false } = params;
  let { abortSignal } = params;
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();

  if (!cache) {
    return [];
  }

  const changes: FileChange[] = [];

  const tablePositions: TablePosition[] = (cache.sections ?? []).filter((section) => section.type === 'table').map((section) => ({
    end: section.position.end.offset,
    start: section.position.start.offset
  }));

  for (const link of getLinks({ cache, shouldIncludeExternalLinks })) {
    abortSignal.throwIfAborted();
    const newContent = await linkConverter(link, abortSignal);
    abortSignal.throwIfAborted();
    if (newContent === undefined) {
      continue;
    }

    const fileChange = referenceToFileChange(link, newContent);

    if (isCanvasFileCache) {
      if (isCanvasChange(fileChange)) {
        changes.push(fileChange);
      } else {
        console.error('Unsupported file change', fileChange);
        continue;
      }
    } else {
      if (shouldEscapeWikilinkDivider(fileChange, tablePositions)) {
        fileChange.newContent = fileChange.newContent.replaceAll(UNESCAPED_WIKILINK_DIVIDER_REGEXP, ESCAPED_WIKILINK_DIVIDER);
      }

      changes.push(fileChange);
    }
  }
  return changes;
}

function getFinalLinkPathStyle(app: App, linkPathStyle?: LinkPathStyle): FinalLinkPathStyle {
  const resolvedStyle = linkPathStyle ?? LinkPathStyle.ObsidianSettingsDefault;
  switch (resolvedStyle) {
    case LinkPathStyle.AbsolutePathInVault:
      return FinalLinkPathStyle.AbsolutePathInVault;
    case LinkPathStyle.ObsidianSettingsDefault:
      return resolveFinalLinkPathStyleFromObsidianSettings(app);
    case LinkPathStyle.RelativePathToTheSource:
      return FinalLinkPathStyle.RelativePathToTheSource;
    case LinkPathStyle.ShortestPathWhenPossible:
      return FinalLinkPathStyle.ShortestPathWhenPossible;
    default:
      assertNever(resolvedStyle);
  }
}

function getLinkConfig(params: GenerateMarkdownLinkParams): LinkConfig {
  const { app } = params;
  return {
    isEmbed: params.isEmbed ?? (params.originalLink ? testEmbed(params.originalLink) : false),
    isSingleSubpathAllowed: params.isSingleSubpathAllowed ?? true,
    isWikilink: shouldUseWikilinkStyle(normalizeOptionalProperties<ShouldUseWikilinkStyleParams>({
      app,
      linkStyle: params.linkStyle,
      originalLink: params.originalLink
    })),
    linkPathStyle: getFinalLinkPathStyle(app, params.linkPathStyle),
    shouldUseAngleBrackets: params.shouldUseAngleBrackets ?? (params.originalLink ? testAngleBrackets(params.originalLink) : undefined) ?? false,
    shouldUseLeadingDotForRelativePaths: params.shouldUseLeadingDotForRelativePaths
      ?? (params.originalLink ? testLeadingDot(params.originalLink) : undefined) ?? false,
    shouldUseLeadingSlashForAbsolutePaths: params.shouldUseLeadingSlashForAbsolutePaths
      ?? (params.originalLink ? testLeadingSlash(params.originalLink) : undefined) ?? false
  };
}

function normalizeFileUrlLink(link: Reference, shouldUseAngleBrackets: boolean): MaybeReturn<string> {
  if (!isParseLinkReference(link)) {
    return;
  }

  const { parseLinkResult } = link;
  if (!parseLinkResult.isFileUrl) {
    return;
  }

  return generateRawMarkdownLink(normalizeOptionalProperties<GenerateRawMarkdownLinkParams>({
    alias: parseLinkResult.alias,
    isEmbed: parseLinkResult.isEmbed,
    isWikilink: false,
    shouldUseAngleBrackets,
    url: normalizeFileUrl(parseLinkResult.url)
  }));
}

function resolveFinalLinkPathStyleFromObsidianSettings(app: App): FinalLinkPathStyle {
  const newLinkFormat = getNewLinkFormat(app);
  switch (newLinkFormat) {
    case 'absolute':
      return FinalLinkPathStyle.AbsolutePathInVault;
    case 'relative':
      return FinalLinkPathStyle.RelativePathToTheSource;
    case 'shortest':
      return FinalLinkPathStyle.ShortestPathWhenPossible;
    default:
      assertNever(newLinkFormat);
  }
}

function shouldEscapeWikilinkDivider(fileChange: FileChange, tablePositions: TablePosition[]): boolean {
  /* v8 ignore start -- getFileChanges only calls this for non-canvas files which always have content changes. */
  if (!isContentChange(fileChange)) {
    return false;
  }
  /* v8 ignore stop */

  if (!UNESCAPED_WIKILINK_DIVIDER_REGEXP.test(fileChange.newContent)) {
    return false;
  }

  return tablePositions.some((tablePosition) => tablePosition.start <= fileChange.reference.position.start.offset && fileChange.reference.position.end.offset <= tablePosition.end);
}

function shouldUseWikilinkStyle(params: ShouldUseWikilinkStyleParams): boolean {
  const { app, linkStyle, originalLink } = params;
  const resolvedStyle = linkStyle ?? LinkStyle.PreserveExisting;
  switch (resolvedStyle) {
    case LinkStyle.Markdown:
      return false;
    case LinkStyle.ObsidianSettingsDefault:
      return shouldUseWikilinks(app);
    case LinkStyle.PreserveExisting:
      return originalLink === undefined ? shouldUseWikilinks(app) : testWikilink(originalLink);
    case LinkStyle.Wikilink:
      return true;
    default:
      assertNever(resolvedStyle);
  }
}
