/**
 * @packageDocumentation Link
 * This module provides utilities for handling and updating links within Obsidian vaults. It includes
 * functions to split paths, update links in files, and generate markdown links with various options.
 * The functions integrate with Obsidian's API to ensure that links are managed correctly within the vault.
 **/

import type {
  App,
  ReferenceCache,
  TFile
} from 'obsidian';
import { normalizePath } from 'obsidian';
import { createTFileInstance } from 'obsidian-typings/implementations';

import type {
  MaybePromise,
  RetryOptions
} from '../Async.ts';
import { throwExpression } from '../Error.ts';
import {
  basename,
  dirname,
  extname,
  relative
} from '../Path.ts';
import { normalize } from '../String.ts';
import {
  getAllLinks,
  getCacheSafe,
  tempRegisterFileAndRun
} from './MetadataCache.ts';
import {
  shouldUseRelativeLinks,
  shouldUseWikilinks
} from './ObsidianSettings.ts';
import {
  getPath,
  isMarkdownFile,
  trimMarkdownExtension
} from './TAbstractFile.ts';
import type { PathOrFile } from './TFile.ts';
import { getFile } from './TFile.ts';
import type { FileChange } from './Vault.ts';
import { applyFileChanges } from './Vault.ts';

/**
 * Regular expression for special link symbols.
 */
// eslint-disable-next-line no-control-regex
const SPECIAL_LINK_SYMBOLS_REGEXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

/**
 * Splits a link into its link path and subpath.
 */
export interface SplitSubpathResult {
  /**
   * The link path.
   */
  linkPath: string;

  /**
   * The subpath.
   */
  subpath: string | undefined;
}

/**
 * Splits a link into its link path and subpath.
 *
 * @param link - The link to split.
 * @returns An object containing the link path and subpath.
 */
export function splitSubpath(link: string): SplitSubpathResult {
  const SUBPATH_SEPARATOR = '#';
  const [linkPath = '', subpath] = normalize(link).split(SUBPATH_SEPARATOR);
  return {
    linkPath,
    subpath: subpath ? SUBPATH_SEPARATOR + subpath : undefined
  };
}

/**
 * Options for updating links in a file.
 */
export interface UpdateLinksInFileOptions {
  /**
   * The obsidian app instance.
   */
  app: App;

  /**
   * The file to update the links in.
   */
  pathOrFile: PathOrFile;

  /**
   * The old path of the file.
   */
  oldPathOrFile: PathOrFile;

  /**
   * A map of old and new paths for renaming links.
   */
  renameMap: Map<string, string>;

  /**
   * Whether to force the links to be in Markdown format.
   */
  forceMarkdownLinks?: boolean | undefined;

  /**
   * Whether to update only embedded links.
   */
  embedOnlyLinks?: boolean | undefined;
}

/**
 * Updates the links in a file based on the provided parameters.
 *
 * @param options - The options for updating the links.
 * @returns A promise that resolves when the links are updated.
 */
export async function updateLinksInFile(options: UpdateLinksInFileOptions): Promise<void> {
  const {
    app,
    pathOrFile,
    oldPathOrFile,
    renameMap,
    forceMarkdownLinks,
    embedOnlyLinks
  } = options;
  await editLinks(app, pathOrFile, (link) => {
    const isEmbedLink = testEmbed(link.original);
    if (embedOnlyLinks !== undefined && embedOnlyLinks !== isEmbedLink) {
      return;
    }
    return convertLink(app, link, pathOrFile, oldPathOrFile, renameMap, forceMarkdownLinks);
  });
}

/**
 * Converts a link to a new path.
 *
 * @param app - The Obsidian application instance.
 * @param link - The reference cache for the link.
 * @param source - The source file.
 * @param oldPathOrFile - The old path of the link.
 * @param renameMap - A map of old paths to new paths for renaming.
 * @param forceMarkdownLinks - Optional flag to force markdown links.
 * @returns The converted link.
 */
function convertLink(app: App, link: ReferenceCache, source: PathOrFile, oldPathOrFile: PathOrFile, renameMap: Map<string, string>, forceMarkdownLinks?: boolean): string {
  oldPathOrFile ||= getPath(source);
  return updateLink({
    app,
    link,
    pathOrFile: extractLinkFile(app, link, oldPathOrFile),
    oldPathOrFile,
    sourcePathOrFile: source,
    renameMap,
    forceMarkdownLinks
  });
}

/**
 * Extracts the file associated with a link.
 *
 * @param app - The Obsidian application instance.
 * @param link - The reference cache for the link.
 * @param oldPathOrFile - The old path of the file.
 * @returns The file associated with the link, or null if not found.
 */
export function extractLinkFile(app: App, link: ReferenceCache, oldPathOrFile: PathOrFile): TFile | null {
  const { linkPath } = splitSubpath(link.link);
  return app.metadataCache.getFirstLinkpathDest(linkPath, getPath(oldPathOrFile));
}

/**
 * Options for updating a link.
 */
export interface UpdateLinkOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The reference cache for the link.
   */
  link: ReferenceCache;

  /**
   * The file associated with the link.
   */
  pathOrFile: PathOrFile | null;

  /**
   * The old path of the file.
   */
  oldPathOrFile: PathOrFile;

  /**
   * The source file containing the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * A map of old and new file paths.
   */
  renameMap: Map<string, string>;

  /**
   * Whether to force markdown links.
   */
  forceMarkdownLinks?: boolean | undefined;
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
    pathOrFile,
    oldPathOrFile,
    sourcePathOrFile: source,
    renameMap,
    forceMarkdownLinks
  } = options;
  if (!pathOrFile) {
    return link.original;
  }
  let file = getFile(app, pathOrFile);
  const sourcePath = getPath(source);
  const oldPath = getPath(oldPathOrFile);
  const isWikilink = testWikilink(link.original) && forceMarkdownLinks !== true;
  const { subpath } = splitSubpath(link.link);

  const newPath = renameMap.get(file.path);
  const alias = getAlias({
    app,
    displayText: link.displayText,
    file: pathOrFile,
    otherPaths: [oldPath, newPath],
    sourcePath,
    isWikilink
  });

  if (newPath) {
    file = createTFileInstance(app.vault, newPath);
  }

  const newLink = generateMarkdownLink({
    app,
    pathOrFile: file,
    sourcePathOrFile: sourcePath,
    subpath,
    alias,
    isWikilink: forceMarkdownLinks ? false : undefined,
    originalLink: link.original
  });
  return newLink;
}

/**
 * Options for getting the alias of a link.
 */
export interface GetAliasOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The display text of the link.
   */
  displayText: string | undefined;

  /**
   * The path or file of the link.
   */
  file: PathOrFile;

  /**
   * Other paths associated with the link.
   */
  otherPaths: (string | undefined)[];

  /**
   * The source path of the link.
   */
  sourcePath: string;

  /**
   * Indicates if the link is a wikilink.
   */
  isWikilink?: boolean;
}

/**
 * Retrieves the alias for a given link.
 *
 * @param options - The options for retrieving the alias.
 * @returns The alias of the link, or undefined if should be default.
 */
export function getAlias(options: GetAliasOptions): string | undefined {
  const {
    app,
    displayText,
    file: pathOrFile,
    otherPaths,
    sourcePath,
    isWikilink
  } = options;
  if (isWikilink === false) {
    return displayText;
  }

  const file = getFile(app, pathOrFile);

  if (!displayText) {
    return undefined;
  }

  const cleanDisplayText = normalizePath(displayText.split(' > ')[0] ?? throwExpression(new Error('Invalid display text'))).replace(/\.\//g, '');

  for (const path of [file.path, ...otherPaths]) {
    if (!path) {
      continue;
    }
    const extension = extname(path);
    const fileNameWithExtension = basename(path);
    const fileNameWithoutExtension = basename(path, extension);
    if (cleanDisplayText === path || cleanDisplayText === fileNameWithExtension || cleanDisplayText === fileNameWithoutExtension) {
      return undefined;
    }
  }

  for (const omitMdExtension of [true, false]) {
    const linkText = app.metadataCache.fileToLinktext(file, sourcePath, omitMdExtension);
    if (cleanDisplayText === linkText) {
      return undefined;
    }
  }

  return displayText;
}

/**
 * Wrapper for default options for generating markdown links.
 */
export interface GenerateMarkdownLinkDefaultOptionsWrapper {
  /**
   * The default options for generating markdown links.
   */
  defaultOptionsFn?: () => Partial<GenerateMarkdownLinkOptions>;
}

/**
 * Options for generating a markdown link.
 */
export interface GenerateMarkdownLinkOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The file to link to.
   */
  pathOrFile: PathOrFile;

  /**
   * The source path of the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * The subpath of the link.
   */
  subpath?: string | undefined;

  /**
   * The alias for the link.
   */
  alias?: string | undefined;

  /**
   * Indicates if the link should be embedded. If not provided, it will be inferred based on the file type.
   */
  isEmbed?: boolean | undefined;

  /**
   * Indicates if the link should be a wikilink. If not provided, it will be inferred based on the Obsidian settings.
   */
  isWikilink?: boolean | undefined;

  /**
   * Indicates if the link should be relative. If not provided or `false`, it will be inferred based on the Obsidian settings.
   */
  forceRelativePath?: boolean | undefined;

  /**
   * Indicates if the link should use a leading dot. Defaults to `false`. Has no effect if `isWikilink` is `true` or `isRelative` is `false`.
   */
  useLeadingDot?: boolean | undefined;

  /**
   * Indicates if the link should use angle brackets. Defaults to `false`. Has no effect if `isWikilink` is `true`
   */
  useAngleBrackets?: boolean | undefined;

  /**
    * The original link text. If provided, it will be used to infer the values of `isEmbed`, `isWikilink`, `useLeadingDot`, and `useAngleBrackets`.
    * These inferred values will be overridden by corresponding settings if specified.
    */
  originalLink?: string | undefined;
}

/**
 * Generates a markdown link based on the provided parameters.
 *
 * @param options - The options for generating the markdown link.
 * @returns The generated markdown link.
 */
export function generateMarkdownLink(options: GenerateMarkdownLinkOptions): string {
  const { app } = options;

  const defaultOptionsFn = (app.fileManager.generateMarkdownLink as GenerateMarkdownLinkDefaultOptionsWrapper).defaultOptionsFn ?? ((): Partial<GenerateMarkdownLinkOptions> => ({}));
  const defaultOptions = defaultOptionsFn();

  options = { ...defaultOptions, ...options };

  const file = getFile(app, options.pathOrFile);

  return tempRegisterFileAndRun(app, file, () => {
    const sourcePath = getPath(options.sourcePathOrFile);
    const subpath = options.subpath ?? '';
    let alias = options.alias ?? '';
    const isEmbed = options.isEmbed ?? (options.originalLink ? testEmbed(options.originalLink) : undefined) ?? !isMarkdownFile(file);
    const isWikilink = options.isWikilink ?? (options.originalLink ? testWikilink(options.originalLink) : undefined) ?? shouldUseWikilinks(app);
    const forceRelativePath = options.forceRelativePath ?? shouldUseRelativeLinks(app);
    const useLeadingDot = options.useLeadingDot ?? (options.originalLink ? testLeadingDot(options.originalLink) : undefined) ?? false;
    const useAngleBrackets = options.useAngleBrackets ?? (options.originalLink ? testAngleBrackets(options.originalLink) : undefined) ?? false;

    let linkText = file.path === sourcePath && subpath
      ? subpath
      : forceRelativePath
        ? relative(dirname(sourcePath), isWikilink ? trimMarkdownExtension(file) : file.path) + subpath
        : app.metadataCache.fileToLinktext(file, sourcePath, isWikilink) + subpath;

    if (forceRelativePath && useLeadingDot && !linkText.startsWith('.') && !linkText.startsWith('#')) {
      linkText = './' + linkText;
    }

    if (!isWikilink) {
      if (useAngleBrackets) {
        linkText = `<${linkText}>`;
      } else {
        linkText = linkText.replace(SPECIAL_LINK_SYMBOLS_REGEXP, function (specialLinkSymbol) {
          return encodeURIComponent(specialLinkSymbol);
        });
      }

      if (!isEmbed) {
        return `[${alias || file.basename}](${linkText})`;
      } else {
        return `![${alias}](${linkText})`;
      }
    } else {
      if (alias && alias.toLowerCase() === linkText.toLowerCase()) {
        linkText = alias;
        alias = '';
      }

      return (isEmbed ? '!' : '') + (alias ? `[[${linkText}|${alias}]]` : `[[${linkText}]]`);
    }
  });
}

/**
 * Edits the links in the specified file or path using the provided link converter function.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file to edit the links in.
 * @param linkConverter - The function that converts each link.
 * @param retryOptions - Optional options for retrying the operation.
 * @returns A promise that resolves when the links have been edited.
 */
export async function editLinks(
  app: App,
  pathOrFile: PathOrFile,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  linkConverter: (link: ReferenceCache) => MaybePromise<string | void>,
  retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  await applyFileChanges(app, pathOrFile, async () => {
    const cache = await getCacheSafe(app, pathOrFile);
    if (!cache) {
      return [];
    }

    const changes: FileChange[] = [];

    for (const link of getAllLinks(cache)) {
      const newContent = await linkConverter(link);
      if (newContent === undefined) {
        continue;
      }

      changes.push({
        startIndex: link.position.start.offset,
        endIndex: link.position.end.offset,
        oldContent: link.original,
        newContent
      });
    }

    return changes;
  }, retryOptions);
}

/**
 * Tests whether a link is an embed link:
 * `![[link]]`, `![title](link)`.
 *
 * @param link - Link to test
 * @returns Whether the link is an embed link
 */
export function testEmbed(link: string): boolean {
  return link.startsWith('![');
}

/**
 * Tests whether a link is a wikilink, possibly embed:
 * `[[link]]`, `![[link]]`.
 *
 * @param link - Link to test
 * @returns Whether the link is a wikilink
 */
export function testWikilink(link: string): boolean {
  return link.includes('[[');
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
  return link.includes('[[./') || link.includes('](./') || link.includes('](<./');
}

/**
 * Tests whether a link uses angle brackets, possibly embed:
 * `[title](<link>)`, `![title](<link>)`.
 *
 * @param link - Link to test
 * @returns Whether the link uses angle brackets
 */
export function testAngleBrackets(link: string): boolean {
  return link.includes('](<');
}
