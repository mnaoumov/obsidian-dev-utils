/**
 * @packageDocumentation
 *
 * This module provides utilities for handling and updating links within Obsidian vaults. It includes
 * functions to split paths, update links in files, and generate markdown links with various options.
 */

import type { Link } from 'mdast';
import type {
  App,
  CachedMetadata,
  Reference,
  TFile
} from 'obsidian';
import type { Promisable } from 'type-fest';
import type { Node } from 'unist';

import {
  normalizePath,
  parseLinktext
} from 'obsidian';
import { InternalPluginName } from 'obsidian-typings/implementations';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import { wikiLinkPlugin } from 'remark-wiki-link';
import { visit } from 'unist-util-visit';

import type { GenericObject } from '../ObjectUtils.ts';
import type { MaybeReturn } from '../Type.ts';
import type { FileChange } from './FileChange.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { ProcessOptions } from './Vault.ts';

import { abortSignalNever } from '../AbortController.ts';
import {
  normalizeOptionalProperties,
  toJson
} from '../ObjectUtils.ts';
import {
  basename,
  dirname,
  extname,
  join,
  relative
} from '../Path.ts';
import {
  normalize,
  replaceAll,
  trimEnd
} from '../String.ts';
import { isUrl } from '../url.ts';
import {
  applyContentChanges,
  applyFileChanges,
  isCanvasChange,
  isContentChange
} from './FileChange.ts';
import {
  getFile,
  getPath,
  isCanvasFile,
  isMarkdownFile,
  MARKDOWN_FILE_EXTENSION
} from './FileSystem.ts';
import {
  getAllLinks,
  getBacklinksForFileSafe,
  getCacheSafe,
  parseMetadata,
  tempRegisterFilesAndRun
} from './MetadataCache.ts';
import {
  getNewLinkFormat,
  shouldUseWikilinks
} from './ObsidianSettings.ts';
import {
  isCanvasFileNodeReference,
  referenceToFileChange
} from './Reference.ts';

const ESCAPED_WIKILINK_DIVIDER = '\\|';

/**
 * Regular expression for special link symbols.
 */
// eslint-disable-next-line no-control-regex
const SPECIAL_LINK_SYMBOLS_REGEXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

/**
 * Regular expression for special markdown link symbols.
 */
const SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX = /[\\[\]<>_*~=`$]/g;

/**
 * Regular expression for unescaped pipes.
 */
const UNESCAPED_WIKILINK_DIVIDER_REGEXP = /(?<!\\)\|/g;

const WIKILINK_DIVIDER = '|';

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
 * Options for {@link convertLink}.
 */
export interface ConvertLinkOptions {
  /**
   * An Obsidian app instance.
   */
  app: App;

  /**
   * A reference for the link.
   */
  link: Reference;

  /**
   * A style of the link.
   */
  linkStyle?: LinkStyle;

  /**
   * A source file containing the link.
   */
  newSourcePathOrFile: PathOrFile;

  /**
   * An old path of the link.
   */
  oldSourcePathOrFile?: PathOrFile;

  /**
   * Whether to update file name alias. Defaults to `true`.
   */
  shouldUpdateFileNameAlias?: boolean;
}

/**
 * Options for {@link generateMarkdownLink}.
 */
export interface GenerateMarkdownLinkOptions {
  /**
   * An alias for the link.
   *
   * @example `[[alias|link]]`
   * @example `[alias](link.md)`
   */
  alias?: string;

  /**
   * An Obsidian app instance.
   */
  app: App;

  /**
   * Indicates if the link should be embedded. If not provided, it will be inferred based on the file type.
   *
   * If `true`: `![[target]]`.
   *
   * If `false`: `[[target]]`.
   */
  isEmbed?: boolean;

  /**
   * Whether to allow an empty alias for embeds. Defaults to `true`.
   *
   * Applicable only if the result link style is {@link LinkStyle.Markdown}.
   *
   * If `true`: `![](foo.png)`.
   *
   * If `false`: `![foo](foo.png)`.
   */
  isEmptyEmbedAliasAllowed?: boolean;

  /**
   * Whether to allow non-existing files. Defaults to `false`.
   *
   * If `false` and {@link targetPathOrFile} is a non-existing file, an error will be thrown.
   */
  isNonExistingFileAllowed?: boolean;

  /**
   * Whether to allow a single subpath. Defaults to `true`.
   *
   * Applicable only if {@link targetPathOrFile} and {@link sourcePathOrFile} are the same file.
   *
   * If `true`: `[[#subpath]]`.
   *
   * If `false`: `[[source#subpath]]`
   */
  isSingleSubpathAllowed?: boolean;

  /**
   * A style of the link path.
   */
  linkPathStyle?: LinkPathStyle;

  /**
   * A style of the link.
   */
  linkStyle?: LinkStyle;

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
  originalLink?: string;

  /**
   * Whether to escape the alias. Defaults to `false`.
   *
   * Applicable only if the result link style is {@link LinkStyle.Markdown}.
   *
   * If `true`: `[\*\*alias\*\*](link.md)`.
   *
   * If `false`: `[**alias**](link.md)`.
   */
  shouldEscapeAlias?: boolean;

  /**
   * Whether to include the attachment extension in the embed alias. Defaults to `false`.
   *
   * Applicable only if {@link isEmptyEmbedAliasAllowed} is `false`.
   *
   * If `true`: `[foo.png](foo.png)`.
   *
   * If `false`: `[foo](foo.png)`.
   */
  shouldIncludeAttachmentExtensionToEmbedAlias?: boolean;

  /**
   * Indicates if the link should use angle brackets. Defaults to `false`.
   *
   * Applicable only if {@link linkStyle} is {@link LinkStyle.Markdown}.
   *
   * If `true`: `[alias](<path with spaces.md>)`.
   *
   * If `false`: `[alias](path%20with%20spaces.md)`.
   */
  shouldUseAngleBrackets?: boolean;

  /**
   * Indicates if the link should use a leading dot. Defaults to `false`.
   *
   * Applicable only if {@link linkPathStyle} is {@link LinkPathStyle.RelativePathToSource}.
   *
   * If `true`: `[[./relative/path/to/target]]`
   *
   * If `false`: `[[relative/path/to/target]]`
   */
  shouldUseLeadingDotForRelativePaths?: boolean;

  /**
   * Indicates if the link should use a leading slash. Defaults to `false`.
   *
   * Applicable only if {@link linkPathStyle} is {@link LinkPathStyle.AbsolutePathInVault}.
   *
   * If `true`: `[[/absolute/path/to/target]]`
   *
   * If `false`: `[[absolute/path/to/target]]`
   */
  shouldUseLeadingSlashForAbsolutePaths?: boolean;

  /**
   * A source path of the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * A subpath of the link.
   *
   * Should be empty or start with `#`.
   *
   * @example `[[link-with-empty-subpath]]`
   * @example `[[link-with-subpath#subpath]]`
   * @example `[[link-with-subpath#subpath#nested-subpath]]`
   */
  subpath?: string;

  /**
   * A target path or file.
   */
  targetPathOrFile: PathOrFile;
}

/**
 * A result of parsing a link.
 */
export interface ParseLinkResult {
  /**
   * An alias of the link.
   */
  alias?: string;

  /**
   * An encoded URL of the link.
   */
  encodedUrl?: string;

  /**
   * An end offset of the link in the original text.
   */
  endOffset: number;

  /**
   * Indicates if the link has angle brackets.
   */
  hasAngleBrackets?: boolean;

  /**
   * Indicates if the link is an embed link.
   */
  isEmbed: boolean;

  /**
   * Indicates if the link is external.
   */
  isExternal: boolean;

  /**
   * Indicates if the link is a wikilink.
   */
  isWikilink: boolean;

  /**
   * A raw link text.
   */
  raw: string;

  /**
   * A start offset of the link in the original text.
   */
  startOffset: number;

  /**
   * A title of the link.
   */
  title?: string;

  /**
   * An URL of the link.
   */
  url: string;
}

/**
 * Options for {@link shouldResetAlias}.
 */
export interface ShouldResetAliasOptions {
  /**
   * An Obsidian app instance.
   */
  app: App;

  /**
   * A display text of the link.
   */
  displayText: string | undefined;

  /**
   * Indicates if the link is a wikilink.
   */
  isWikilink?: boolean;

  /**
   * A source path of the link.
   */
  newSourcePathOrFile: PathOrFile;

  /**
   * An old source file containing the link.
   */
  oldSourcePathOrFile?: PathOrFile;

  /**
   * An old target path of the link.
   */
  oldTargetPath: PathOrFile;

  /**
   * A target path or file.
   */
  targetPathOrFile: PathOrFile;
}

/**
 * Splits a link into its link path and subpath.
 */
export interface SplitSubpathResult {
  /**
   * A link path.
   */
  linkPath: string;

  /**
   * A subpath.
   */
  subpath: string;
}

/**
 * Options for {@link updateLink}.
 */
export interface UpdateLinkOptions {
  /**
   * An Obsidian app instance.
   */
  app: App;

  /**
   * A reference for the link.
   */
  link: Reference;

  /**
   * Whether to force markdown links.
   */
  linkStyle?: LinkStyle;

  /**
   * A source file containing the link.
   */
  newSourcePathOrFile: PathOrFile;

  /**
   * A file associated with the link.
   */
  newTargetPathOrFile: PathOrFile;

  /**
   * An old source file containing the link.
   */
  oldSourcePathOrFile?: PathOrFile;

  /**
   * An old path of the file.
   */
  oldTargetPathOrFile?: PathOrFile;

  /**
   * Whether to update file name alias. Defaults to `true`.
   */
  shouldUpdateFileNameAlias?: boolean;
}

/**
 * Options for {@link updateLinksInFile}.
 */
export interface UpdateLinksInFileOptions extends ProcessOptions {
  /**
   * An Obsidian app instance.
   */
  app: App;

  /**
   * A style of the link.
   */
  linkStyle?: LinkStyle;

  /**
   * A file to update the links in.
   */
  newSourcePathOrFile: PathOrFile;

  /**
   * An old path of the file.
   */
  oldSourcePathOrFile?: PathOrFile;

  /**
   * Whether to update only embedded links.
   */
  shouldUpdateEmbedOnlyLinks?: boolean;

  /**
   * Whether to update file name alias. Defaults to `true`.
   */
  shouldUpdateFileNameAlias?: boolean;
}

interface LinkConfig {
  isEmbed: boolean;
  isSingleSubpathAllowed: boolean;
  isWikilink: boolean;
  linkPathStyle: FinalLinkPathStyle;
  shouldUseAngleBrackets: boolean;
  shouldUseLeadingDotForRelativePaths: boolean;
  shouldUseLeadingSlashForAbsolutePaths: boolean;
}

interface TablePosition {
  end: number;
  start: number;
}

/**
 * Options for {@link updateLinksInContent}.
 */
interface UpdateLinksInContentOptions {
  /**
   * An Obsidian app instance.
   */
  app: App;

  /**
   * A content to update the links in.
   */
  content: string;

  /**
   * A style of the link.
   */
  linkStyle?: LinkStyle;

  /**
   * A new source path or file.
   */
  newSourcePathOrFile: PathOrFile;

  /**
   * An old source path or file.
   */
  oldSourcePathOrFile?: PathOrFile;

  /**
   * Whether to update only embedded links.
   */
  shouldUpdateEmbedOnlyLinks?: boolean;

  /**
   * Whether to update file name alias.
   */
  shouldUpdateFileNameAlias?: boolean;
}

interface WikiLinkNode extends Node {
  data: {
    alias: string;
  };
  value: string;
}

/**
 * Converts a link to a new path.
 *
 * @param options - The options for converting the link.
 * @returns The converted link.
 */
export function convertLink(options: ConvertLinkOptions): string {
  const targetFile = extractLinkFile(options.app, options.link, options.oldSourcePathOrFile ?? options.newSourcePathOrFile);
  if (!targetFile) {
    return options.link.original;
  }

  return updateLink(normalizeOptionalProperties<UpdateLinkOptions>({
    app: options.app,
    link: options.link,
    linkStyle: options.linkStyle,
    newSourcePathOrFile: options.newSourcePathOrFile,
    newTargetPathOrFile: targetFile,
    oldSourcePathOrFile: options.oldSourcePathOrFile,
    shouldUpdateFileNameAlias: options.shouldUpdateFileNameAlias
  }));
}

/**
 * Edits the backlinks for a file or path.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file to edit the backlinks for.
 * @param linkConverter - The function that converts each link.
 * @param processOptions - Optional options for retrying the operation.
 * @returns A {@link Promise} that resolves when the backlinks have been edited.
 */
export async function editBacklinks(
  app: App,
  pathOrFile: PathOrFile,
  linkConverter: (link: Reference) => Promisable<MaybeReturn<string>>,
  processOptions: ProcessOptions = {}
): Promise<void> {
  const backlinks = await getBacklinksForFileSafe(app, pathOrFile, processOptions);
  for (const backlinkNotePath of backlinks.keys()) {
    const currentLinks = backlinks.get(backlinkNotePath) ?? [];
    const linkJsons = new Set<string>(currentLinks.map((link) => toJson(link)));
    await editLinks(app, backlinkNotePath, (link) => {
      const linkJson = toJson(link);
      if (!linkJsons.has(linkJson)) {
        return;
      }

      return linkConverter(link);
    }, processOptions);
  }
}

/**
 * Edits the backlinks for a file or path.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file to edit the backlinks for.
 * @param linkConverter - The function that converts each link.
 * @param processOptions - Optional options for retrying the operation.
 * @returns A {@link Promise} that resolves when the backlinks have been edited.
 */
export async function editLinks(
  app: App,
  pathOrFile: PathOrFile,
  linkConverter: (link: Reference) => Promisable<MaybeReturn<string>>,
  processOptions: ProcessOptions = {}
): Promise<void> {
  await applyFileChanges(app, pathOrFile, async (abortSignal, content) => {
    const cache = await getCacheSafe(app, pathOrFile);
    abortSignal.throwIfAborted();
    const file = getFile(app, pathOrFile);
    const cachedContent = await app.vault.cachedRead(file);
    abortSignal.throwIfAborted();
    if (content !== cachedContent) {
      return null;
    }

    return await getFileChanges(cache, isCanvasFile(app, pathOrFile), linkConverter, abortSignal);
  }, processOptions);
}

/**
 * Edits the links in a content string.
 *
 * @param app - The Obsidian application instance.
 * @param content - The content to edit the links in.
 * @param linkConverter - The function that converts each link.
 * @param abortSignal - The abort signal to control the execution of the function.
 * @returns The promise that resolves to the updated content.
 */
export async function editLinksInContent(
  app: App,
  content: string,
  linkConverter: (link: Reference) => Promisable<MaybeReturn<string>>,
  abortSignal?: AbortSignal
): Promise<string> {
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();

  const newContent = await applyContentChanges(abortSignal, content, '', async () => {
    const cache = await parseMetadata(app, content);
    abortSignal.throwIfAborted();
    const changes = await getFileChanges(cache, false, linkConverter, abortSignal);
    abortSignal.throwIfAborted();
    return changes;
  });
  abortSignal.throwIfAborted();

  if (newContent === null) {
    throw new Error('Failed to update links in content');
  }

  return newContent;
}

/**
 * Encodes a URL.
 *
 * @param url - The URL to encode.
 * @returns The encoded URL.
 */
export function encodeUrl(url: string): string {
  return replaceAll(url, SPECIAL_LINK_SYMBOLS_REGEXP, ({ substring: specialLinkSymbol }) => encodeURIComponent(specialLinkSymbol));
}

/**
 * Extracts the file associated with a link.
 *
 * @param app - The Obsidian application instance.
 * @param link - The reference cache for the link.
 * @param sourcePathOrFile - The source path or file.
 * @param shouldAllowNonExistingFile - Whether to allow non-existing files. Defaults to `false`.
 * @returns The file associated with the link, or null if not found.
 */
export function extractLinkFile(app: App, link: Reference, sourcePathOrFile: PathOrFile, shouldAllowNonExistingFile = false): null | TFile {
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
    return getFile(app, linkPath, true);
  }

  const fullLinkPath = join(dirname(sourcePath), `./${linkPath}`);

  if (fullLinkPath.startsWith('../')) {
    return null;
  }

  return getFile(app, fullLinkPath, true);
}

/**
 * Fixes the frontmatter markdown links in the provided metadata cache.
 *
 * @param cache - The metadata cache to fix the frontmatter markdown links in.
 * @returns Whether the frontmatter markdown links were fixed.
 */
export function fixFrontmatterMarkdownLinks(cache: CachedMetadata): boolean {
  return _fixFrontmatterMarkdownLinks(cache.frontmatter, '', cache);
}

/**
 * Generates a markdown link based on the provided parameters.
 *
 * @param options - The options for generating the markdown link.
 * @returns The generated markdown link.
 */
export function generateMarkdownLink(options: GenerateMarkdownLinkOptions): string {
  const { app } = options;

  const DEFAULT_OPTIONS: Partial<GenerateMarkdownLinkOptions> = {
    isEmptyEmbedAliasAllowed: true
  };

  options = { ...DEFAULT_OPTIONS, ...options };

  const targetFile = getFile(app, options.targetPathOrFile, options.isNonExistingFileAllowed);

  return tempRegisterFilesAndRun(app, [targetFile], () => generateMarkdownLinkImpl(options));
}

/**
 * Parses a link into its components.
 *
 * @param str - The link to parse.
 * @returns The parsed link.
 */
export function parseLink(str: string): null | ParseLinkResult {
  const links = parseLinks(str);
  return links[0]?.raw === str ? links[0] : null;
}

/**
 * Parses all links in a string.
 *
 * @param str - The string to parse the links in.
 * @returns The parsed links.
 */
export function parseLinks(str: string): ParseLinkResult[] {
  const embedSymbolOffsets = new Set<number>();

  const EMBED_LINK_PREFIX = '![';
  const NO_EMBED_LINK_PREFIX = ' [';

  const noEmbedStr = replaceAll(str, EMBED_LINK_PREFIX, (args) => {
    embedSymbolOffsets.add(args.offset);
    return NO_EMBED_LINK_PREFIX;
  });

  const processor = remark().use(remarkParse).use(wikiLinkPlugin, { aliasDivider: WIKILINK_DIVIDER });
  const root = processor.parse(noEmbedStr);

  const links: ParseLinkResult[] = [];
  const textLinks: ParseLinkResult[] = [];

  visit(root, (node: Node) => {
    let link: ParseLinkResult;
    switch (node.type) {
      case 'link':
        link = parseLinkNode(node as Link, str);
        break;
      case 'wikiLink':
        link = parseWikilinkNode(node as WikiLinkNode, str);
        break;
      default:
        return;
    }

    if (embedSymbolOffsets.has(link.startOffset - 1)) {
      link.isEmbed = true;
      link.startOffset--;
      link.raw = `!${link.raw}`;
    }
    links.push(link);
  });

  links.sort((a, b) => a.startOffset - b.startOffset);

  let textStartOffset = 0;

  for (const link of links) {
    extractTextLinks(str, textStartOffset, link.startOffset - 1, textLinks);
    textStartOffset = link.endOffset + 1;
  }

  extractTextLinks(str, textStartOffset, str.length - 1, textLinks);

  links.push(...textLinks);
  links.sort((a, b) => a.startOffset - b.startOffset);

  return links;
}

/**
 * Determines if the alias of a link should be reset.
 *
 * @param options - The options for determining if the alias should be reset.
 * @returns Whether the alias should be reset.
 */
export function shouldResetAlias(options: ShouldResetAliasOptions): boolean {
  const {
    app,
    displayText,
    isWikilink,
    newSourcePathOrFile,
    oldSourcePathOrFile,
    oldTargetPath,
    targetPathOrFile
  } = options;
  if (isWikilink === false) {
    return false;
  }

  if (!displayText) {
    return true;
  }

  const targetFile = getFile(app, targetPathOrFile, true);
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

  const cleanDisplayText = replaceAll(normalizePath(displayText.split(' > ')[0] ?? ''), /^\.\//g, '').toLowerCase();

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
 * Updates a link based on the provided parameters.
 *
 * @param options - The options for updating the link.
 * @returns The updated link.
 */
export function updateLink(options: UpdateLinkOptions): string {
  const {
    app,
    link,
    linkStyle,
    newSourcePathOrFile,
    newTargetPathOrFile,
    oldSourcePathOrFile,
    oldTargetPathOrFile,
    shouldUpdateFileNameAlias
  } = options;
  if (!newTargetPathOrFile) {
    return link.original;
  }
  const newTargetFile = getFile(app, newTargetPathOrFile, true);
  const oldSourcePath = getPath(app, oldSourcePathOrFile ?? newSourcePathOrFile);
  const oldTargetPath = getPath(app, oldTargetPathOrFile ?? newTargetPathOrFile);
  const isWikilink = shouldUseWikilinkStyle(app, link.original, linkStyle);

  const { subpath } = splitSubpath(link.link);
  let shouldKeepAlias = !shouldUpdateFileNameAlias;

  if (isCanvasFile(app, newSourcePathOrFile)) {
    if (isCanvasFileNodeReference(link)) {
      return newTargetFile.path + subpath;
    }
  }

  const parseLinkResult = parseLink(link.original);
  let alias: string | undefined;

  if (isWikilink && parseLinkResult?.alias) {
    alias = parseLinkResult.alias;
    shouldKeepAlias = true;
  }

  alias ??= shouldResetAlias(normalizeOptionalProperties<ShouldResetAliasOptions>({
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
    if (alias === basename(oldTargetPath, extname(oldTargetPath))) {
      alias = newTargetFile.basename;
    } else if (alias === basename(oldTargetPath)) {
      alias = newTargetFile.name;
    }
  }

  const newLink = generateMarkdownLink(normalizeOptionalProperties<GenerateMarkdownLinkOptions>({
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
 * @param options - The options for updating the links.
 * @returns A {@link Promise} that resolves to the content with updated links.
 */
export async function updateLinksInContent(options: UpdateLinksInContentOptions): Promise<string> {
  const {
    app,
    content,
    linkStyle,
    newSourcePathOrFile,
    oldSourcePathOrFile,
    shouldUpdateEmbedOnlyLinks,
    shouldUpdateFileNameAlias
  } = options;

  return await editLinksInContent(app, content, (link) => {
    const isEmbedLink = testEmbed(link.original);
    if (shouldUpdateEmbedOnlyLinks !== undefined && shouldUpdateEmbedOnlyLinks !== isEmbedLink) {
      return;
    }
    return convertLink(normalizeOptionalProperties<ConvertLinkOptions>({
      app,
      link,
      linkStyle,
      newSourcePathOrFile,
      oldSourcePathOrFile,
      shouldUpdateFileNameAlias
    }));
  });
}

/**
 * Updates the links in a file based on the provided parameters.
 *
 * @param options - The options for updating the links.
 * @returns A {@link Promise} that resolves when the links are updated.
 */
export async function updateLinksInFile(options: UpdateLinksInFileOptions): Promise<void> {
  const {
    app,
    linkStyle,
    newSourcePathOrFile,
    oldSourcePathOrFile,
    shouldUpdateEmbedOnlyLinks,
    shouldUpdateFileNameAlias
  } = options;

  if (isCanvasFile(app, newSourcePathOrFile) && !app.internalPlugins.getEnabledPluginById(InternalPluginName.Canvas)) {
    return;
  }

  await editLinks(app, newSourcePathOrFile, (link) => {
    const isEmbedLink = testEmbed(link.original);
    if (shouldUpdateEmbedOnlyLinks !== undefined && shouldUpdateEmbedOnlyLinks !== isEmbedLink) {
      return;
    }
    return convertLink(normalizeOptionalProperties<ConvertLinkOptions>({
      app,
      link,
      linkStyle,
      newSourcePathOrFile,
      oldSourcePathOrFile,
      shouldUpdateFileNameAlias
    }));
  }, options);
}

function _fixFrontmatterMarkdownLinks(value: unknown, key: string, cache: CachedMetadata): boolean {
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
    const hasChildFrontmatterLinks = _fixFrontmatterMarkdownLinks(childValue, key ? `${key}.${childKey}` : childKey, cache);
    hasFrontmatterLinks ||= hasChildFrontmatterLinks;
  }

  return hasFrontmatterLinks;
}

function extractTextLinks(str: string, startOffset: number, endOffset: number, textLinks: ParseLinkResult[]): void {
  if (startOffset > endOffset) {
    return;
  }

  const textPart = str.slice(startOffset, endOffset + 1);
  replaceAll(textPart, /(?<Url>\S+)/g, (args, url) => {
    if (!isUrl(url)) {
      return;
    }

    textLinks.push({
      encodedUrl: encodeUrl(url),
      endOffset: startOffset + args.offset + url.length,
      hasAngleBrackets: false,
      isEmbed: false,
      isExternal: true,
      isWikilink: false,
      raw: url,
      startOffset: startOffset + args.offset,
      url
    });
  });
}

function generateLinkText(app: App, targetFile: TFile, sourcePath: string, subpath: string, config: LinkConfig): string {
  if (sourcePath === '/') {
    sourcePath = '';
  }

  let linkText: string;

  if (targetFile.path === sourcePath && subpath && config.isSingleSubpathAllowed) {
    linkText = '';
  } else {
    switch (config.linkPathStyle) {
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
        const shortestName = isMarkdownFile(app, targetFile) ? targetFile.basename : targetFile.name;
        const matchedFiles = app.metadataCache.getLinkpathDest(shortestName, sourcePath);
        linkText = matchedFiles.length === 1 && matchedFiles[0] === targetFile ? targetFile.name : targetFile.path;
        break;
      }
      default:
        throw new Error(`Invalid link path style: ${config.linkPathStyle as string}.`);
    }
  }

  linkText = config.isWikilink ? trimEnd(linkText, `.${MARKDOWN_FILE_EXTENSION}`) : linkText;
  linkText += subpath;

  return linkText;
}

function generateMarkdownLinkImpl(options: GenerateMarkdownLinkOptions): string {
  const { app } = options;
  const targetFile = getFile(app, options.targetPathOrFile, options.isNonExistingFileAllowed);
  const sourcePath = getPath(app, options.sourcePathOrFile);
  const subpath = options.subpath ?? '';

  const linkConfig = getLinkConfig(options, targetFile);
  const linkText = generateLinkText(app, targetFile, sourcePath, subpath, linkConfig);

  return linkConfig.isWikilink
    ? generateWikiLink(linkText, options.alias, linkConfig.isEmbed)
    : generateMarkdownStyleLink(linkText, targetFile, options, linkConfig);
}

function generateMarkdownStyleLink(linkText: string, targetFile: TFile, options: GenerateMarkdownLinkOptions, config: LinkConfig): string {
  const { app } = options;
  const embedPrefix = config.isEmbed ? '!' : '';

  const processedLinkText = config.shouldUseAngleBrackets
    ? `<${linkText}>`
    : encodeUrl(linkText);

  let alias = options.alias ?? '';
  if (!alias && (!config.isEmbed || !options.isEmptyEmbedAliasAllowed)) {
    alias = !options.shouldIncludeAttachmentExtensionToEmbedAlias || isMarkdownFile(app, targetFile)
      ? targetFile.basename
      : targetFile.name;
  }

  const escapedAlias = options.shouldEscapeAlias ? replaceAll(alias, SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX, '\\$&') : alias;
  return `${embedPrefix}[${escapedAlias}](${processedLinkText})`;
}

function generateWikiLink(linkText: string, alias: string | undefined, isEmbed: boolean): string {
  const embedPrefix = isEmbed ? '!' : '';
  const normalizedAlias = alias ?? '';

  if (normalizedAlias && normalizedAlias.toLowerCase() === linkText.toLowerCase()) {
    return `${embedPrefix}[[${normalizedAlias}]]`;
  }

  const aliasPart = normalizedAlias ? `|${normalizedAlias}` : '';
  return `${embedPrefix}[[${linkText}${aliasPart}]]`;
}

async function getFileChanges(
  cache: CachedMetadata | null,
  isCanvasFileCache: boolean,
  linkConverter: (link: Reference, abortSignal: AbortSignal) => Promisable<MaybeReturn<string>>,
  abortSignal?: AbortSignal
): Promise<FileChange[]> {
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

  for (const link of getAllLinks(cache)) {
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
        const message = 'Unsupported file change';
        console.error(message, fileChange);
        throw new Error(message);
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
  switch (linkPathStyle ?? LinkPathStyle.ObsidianSettingsDefault) {
    case LinkPathStyle.AbsolutePathInVault:
      return FinalLinkPathStyle.AbsolutePathInVault;
    case LinkPathStyle.RelativePathToTheSource:
      return FinalLinkPathStyle.RelativePathToTheSource;
    case LinkPathStyle.ShortestPathWhenPossible:
      return FinalLinkPathStyle.ShortestPathWhenPossible;
    case LinkPathStyle.ObsidianSettingsDefault: {
      const newLinkFormat = getNewLinkFormat(app);
      switch (newLinkFormat) {
        case 'absolute':
          return FinalLinkPathStyle.AbsolutePathInVault;
        case 'relative':
          return FinalLinkPathStyle.RelativePathToTheSource;
        case 'shortest':
          return FinalLinkPathStyle.ShortestPathWhenPossible;
        default:
          throw new Error(`Invalid link format: ${newLinkFormat as string}.`);
      }
    }
    default:
      throw new Error(`Invalid link path style: ${linkPathStyle as string}.`);
  }
}

function getLinkConfig(options: GenerateMarkdownLinkOptions, targetFile: TFile): LinkConfig {
  const { app } = options;
  return {
    isEmbed: options.isEmbed ?? (options.originalLink ? testEmbed(options.originalLink) : undefined) ?? !isMarkdownFile(app, targetFile),
    isSingleSubpathAllowed: options.isSingleSubpathAllowed ?? true,
    isWikilink: shouldUseWikilinkStyle(app, options.originalLink, options.linkStyle),
    linkPathStyle: getFinalLinkPathStyle(app, options.linkPathStyle),
    shouldUseAngleBrackets: options.shouldUseAngleBrackets ?? (options.originalLink ? testAngleBrackets(options.originalLink) : undefined) ?? false,
    shouldUseLeadingDotForRelativePaths: options.shouldUseLeadingDotForRelativePaths
      ?? (options.originalLink ? testLeadingDot(options.originalLink) : undefined) ?? false,
    shouldUseLeadingSlashForAbsolutePaths: options.shouldUseLeadingSlashForAbsolutePaths
      ?? (options.originalLink ? testLeadingSlash(options.originalLink) : undefined) ?? false
  };
}

function getRawLink(node: Node, str: string): string {
  return str.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0);
}

function parseLinkNode(node: Link, str: string): ParseLinkResult {
  const OPEN_ANGLE_BRACKET = '<';
  const LINK_ALIAS_SUFFIX = '](';
  const LINK_SUFFIX = ')';
  const raw = getRawLink(node, str);
  const aliasNodeStartOffset = node.children[0]?.position?.start.offset ?? 1;
  const aliasNodeEndOffset = node.children.at(-1)?.position?.end.offset ?? 1;
  const rawUrl = str.slice(aliasNodeEndOffset + LINK_ALIAS_SUFFIX.length, (node.position?.end.offset ?? 0) - LINK_SUFFIX.length);
  const hasAngleBrackets = raw.startsWith(OPEN_ANGLE_BRACKET) || rawUrl.startsWith(OPEN_ANGLE_BRACKET);
  const isExternal = isUrl(node.url);
  let url = node.url;
  if (!isExternal && !hasAngleBrackets) {
    try {
      url = decodeURIComponent(url);
    } catch (error) {
      console.error(`Failed to decode URL ${url}`, error);
    }
  }
  return normalizeOptionalProperties<ParseLinkResult>({
    alias: aliasNodeStartOffset < aliasNodeEndOffset ? str.slice(aliasNodeStartOffset, aliasNodeEndOffset) : undefined,
    encodedUrl: isExternal ? encodeUrl(url) : undefined,
    endOffset: node.position?.end.offset ?? 0,
    hasAngleBrackets,
    isEmbed: false,
    isExternal,
    isWikilink: false,
    raw,
    startOffset: node.position?.start.offset ?? 0,
    title: node.title ?? undefined,
    url
  });
}

function parseWikilinkNode(node: WikiLinkNode, str: string): ParseLinkResult {
  return normalizeOptionalProperties<ParseLinkResult>({
    alias: str.includes(WIKILINK_DIVIDER) ? node.data.alias : undefined,
    endOffset: node.position?.end.offset ?? 0,
    isEmbed: false,
    isExternal: false,
    isWikilink: true,
    raw: getRawLink(node, str),
    startOffset: node.position?.start.offset ?? 0,
    url: node.value
  });
}

function shouldEscapeWikilinkDivider(fileChange: FileChange, tablePositions: TablePosition[]): boolean {
  if (!isContentChange(fileChange)) {
    return false;
  }

  if (!UNESCAPED_WIKILINK_DIVIDER_REGEXP.test(fileChange.newContent)) {
    return false;
  }

  return tablePositions.some((tablePosition) =>
    tablePosition.start <= fileChange.reference.position.start.offset && fileChange.reference.position.end.offset <= tablePosition.end
  );
}

function shouldUseWikilinkStyle(app: App, originalLink?: string, linkStyle?: LinkStyle): boolean {
  switch (linkStyle ?? LinkStyle.PreserveExisting) {
    case LinkStyle.Markdown:
      return false;
    case LinkStyle.ObsidianSettingsDefault:
      return shouldUseWikilinks(app);
    case LinkStyle.PreserveExisting:
      return originalLink === undefined ? shouldUseWikilinks(app) : testWikilink(originalLink);
    case LinkStyle.Wikilink:
      return true;
    default:
      throw new Error(`Invalid link style: ${linkStyle as string}.`);
  }
}
