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

import type {
  MaybePromise,
  RetryOptions
} from '../Async.ts';
import {
  basename,
  dirname,
  extname,
  join,
  relative
} from '../Path.ts';
import { normalize } from '../String.ts';
import type { PathOrFile } from './FileSystem.ts';
import {
  getFile,
  getPath,
  isMarkdownFile,
  trimMarkdownExtension
} from './FileSystem.ts';
import {
  getAllLinks,
  getCacheSafe,
  tempRegisterFileAndRun
} from './MetadataCache.ts';
import {
  shouldUseRelativeLinks,
  shouldUseWikilinks
} from './ObsidianSettings.ts';
import type { FileChange } from './Vault.ts';
import { applyFileChanges } from './Vault.ts';

/**
 * Regular expression for special link symbols.
 */
// eslint-disable-next-line no-control-regex
const SPECIAL_LINK_SYMBOLS_REGEXP = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

/**
 * Regular expression for special markdown link symbols.
 */
const SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX = /[\\\[\]<>_*~=`$]/g;

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
  oldPathOrFile?: PathOrFile | undefined;

  /**
   * A map of old and new paths for renaming links.
   */
  renameMap?: Map<string, string> | undefined;

  /**
   * Whether to force the links to be in Markdown format.
   */
  forceMarkdownLinks?: boolean | undefined;

  /**
   * Whether to update only embedded links.
   */
  embedOnlyLinks?: boolean | undefined;

  /**
   * Whether to update filename alias. Defaults to `true`.
   */
  shouldUpdateFilenameAlias?: boolean | undefined;
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
    embedOnlyLinks,
    shouldUpdateFilenameAlias
  } = options;
  await editLinks(app, pathOrFile, (link) => {
    const isEmbedLink = testEmbed(link.original);
    if (embedOnlyLinks !== undefined && embedOnlyLinks !== isEmbedLink) {
      return;
    }
    return convertLink({
      app,
      link,
      sourcePathOrFile: pathOrFile,
      oldPathOrFile,
      renameMap,
      forceMarkdownLinks,
      shouldUpdateFilenameAlias
    });
  });
}

/**
 * Options for converting a link.
 */
export interface ConvertLinkOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The reference cache for the link.
   */
  link: ReferenceCache;

  /**
   * The source file containing the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * The old path of the link.
   */
  oldPathOrFile?: PathOrFile | undefined;

  /**
   * A map of old and new file paths.
   */
  renameMap?: Map<string, string> | undefined;

  /**
   * Whether to force markdown links.
   */
  forceMarkdownLinks?: boolean | undefined;

  /**
   * Whether to update filename alias. Defaults to `true`.
   */
  shouldUpdateFilenameAlias?: boolean | undefined;
}

/**
 * Converts a link to a new path.
 *
 * @param options - The options for converting the link.
 * @returns The converted link.
 */
export function convertLink(options: ConvertLinkOptions): string {
  return updateLink({
    app: options.app,
    link: options.link,
    pathOrFile: extractLinkFile(options.app, options.link, options.sourcePathOrFile),
    oldPathOrFile: options.oldPathOrFile,
    sourcePathOrFile: options.sourcePathOrFile,
    renameMap: options.renameMap,
    forceMarkdownLinks: options.forceMarkdownLinks,
    shouldUpdateFilenameAlias: options.shouldUpdateFilenameAlias
  });
}

/**
 * Extracts the file associated with a link.
 *
 * @param app - The Obsidian application instance.
 * @param link - The reference cache for the link.
 * @param notePathOrFile - The path or file of the note containing the link.
 * @returns The file associated with the link, or null if not found.
 */
export function extractLinkFile(app: App, link: ReferenceCache, notePathOrFile: PathOrFile): TFile | null {
  const { linkPath } = splitSubpath(link.link);
  return app.metadataCache.getFirstLinkpathDest(linkPath, getPath(notePathOrFile));
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
  oldPathOrFile?: PathOrFile | undefined;

  /**
   * The source file containing the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * A map of old and new file paths.
   */
  renameMap?: Map<string, string> | undefined;

  /**
   * Whether to force markdown links.
   */
  forceMarkdownLinks?: boolean | undefined;

  /**
   * Whether to update filename alias. Defaults to `true`.
   */
  shouldUpdateFilenameAlias?: boolean | undefined;
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
    sourcePathOrFile,
    renameMap,
    forceMarkdownLinks,
    shouldUpdateFilenameAlias
  } = options;
  if (!pathOrFile) {
    return link.original;
  }
  let file = getFile(app, pathOrFile);
  const oldPath = getPath(oldPathOrFile ?? sourcePathOrFile);
  const isWikilink = testWikilink(link.original) && forceMarkdownLinks !== true;
  const { subpath } = splitSubpath(link.link);

  const newPath = renameMap?.get(file.path);
  let alias = shouldResetAlias({
    app,
    displayText: link.displayText,
    pathOrFile,
    otherPathOrFiles: [oldPath, newPath],
    sourcePathOrFile,
    isWikilink
  })
    ? undefined
    : link.displayText;

  if (shouldUpdateFilenameAlias ?? true) {
    if (alias?.toLowerCase() === basename(oldPath, extname(oldPath)).toLowerCase()) {
      alias = file.basename;
    } else if (alias?.toLowerCase() === basename(oldPath).toLowerCase()) {
      alias = file.name;
    }
  }

  if (newPath) {
    file = getFile(app, newPath, true);
  }

  const newLink = generateMarkdownLink({
    app,
    pathOrFile: file,
    sourcePathOrFile,
    subpath,
    alias,
    isWikilink: forceMarkdownLinks ? false : undefined,
    originalLink: link.original
  });
  return newLink;
}

/**
 * Options for determining if the alias of a link should be reset.
 */
export interface ShouldResetAliasOptions {
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
  pathOrFile: PathOrFile;

  /**
   * Other paths associated with the link.
   */
  otherPathOrFiles: (PathOrFile | undefined)[];

  /**
   * The source path of the link.
   */
  sourcePathOrFile: PathOrFile;

  /**
   * Indicates if the link is a wikilink.
   */
  isWikilink?: boolean | undefined;
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
    pathOrFile,
    otherPathOrFiles,
    sourcePathOrFile,
    isWikilink
  } = options;
  if (isWikilink === false) {
    return false;
  }

  const file = getFile(app, pathOrFile);

  if (!displayText) {
    return true;
  }

  const sourcePath = getPath(sourcePathOrFile);
  const sourceDir = dirname(sourcePath);

  const aliasesToReset = new Set<string>();

  for (const pathOrFile of [file.path, ...otherPathOrFiles]) {
    if (!pathOrFile) {
      continue;
    }

    const path = getPath(pathOrFile);
    aliasesToReset.add(path);
    aliasesToReset.add(basename(path));
    aliasesToReset.add(relative(sourceDir, path));
  }

  aliasesToReset.add(app.metadataCache.fileToLinktext(file, sourcePath, false));

  const cleanDisplayText = normalizePath(displayText.split(' > ')[0] ?? '').replace(/^\.\//, '').toLowerCase();

  for (const alias of aliasesToReset) {
    if (alias.toLowerCase() === cleanDisplayText) {
      return true;
    }

    const dir = dirname(alias);
    const base = basename(alias, extname(alias));
    if (join(dir, base).toLowerCase() === cleanDisplayText) {
      return true;
    }
  }

  return false;
}

/**
 * Wrapper for default options for generating markdown links.
 */
export interface GenerateMarkdownLinkDefaultOptionsWrapper {
  /**
   * The default options for generating markdown links.
   */
  defaultOptionsFn: () => Partial<GenerateMarkdownLinkOptions>;
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

  /**
   * Whether to allow non-existing files. If `false` and `pathOrFile` is a non-existing file, an error will be thrown. Defaults to `false`.
   */
  allowNonExistingFile?: boolean | undefined;

  /**
   * Whether to allow an empty alias for embeds. Defaults to `true`.
   */
  allowEmptyEmbedAlias?: boolean | undefined;

  /**
   * Whether to include the attachment extension in the embed alias. Has no effect if `allowEmptyEmbedAlias` is `true`. Defaults to `false`.
   */
  includeAttachmentExtensionToEmbedAlias?: boolean | undefined;
}

/**
 * Generates a markdown link based on the provided parameters.
 *
 * @param options - The options for generating the markdown link.
 * @returns The generated markdown link.
 */
export function generateMarkdownLink(options: GenerateMarkdownLinkOptions): string {
  const { app } = options;

  const configurableDefaultOptionsFn = (app.fileManager.generateMarkdownLink as Partial<GenerateMarkdownLinkDefaultOptionsWrapper>).defaultOptionsFn ?? ((): Partial<GenerateMarkdownLinkOptions> => ({}));
  const configurableDefaultOptions = configurableDefaultOptionsFn();

  const DEFAULT_OPTIONS: Partial<GenerateMarkdownLinkOptions> = {
    allowEmptyEmbedAlias: true
  };

  options = { ...DEFAULT_OPTIONS, ...configurableDefaultOptions, ...options };

  const file = getFile(app, options.pathOrFile, options.allowNonExistingFile);

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

    const embedPrefix = isEmbed ? '!' : '';

    if (!isWikilink) {
      if (useAngleBrackets) {
        linkText = `<${linkText}>`;
      } else {
        linkText = linkText.replace(SPECIAL_LINK_SYMBOLS_REGEXP, function (specialLinkSymbol) {
          return encodeURIComponent(specialLinkSymbol);
        });
      }

      if (!alias && (!isEmbed || !options.allowEmptyEmbedAlias)) {
        alias = !options.includeAttachmentExtensionToEmbedAlias || isMarkdownFile(file) ? file.basename : file.name;
      }

      alias = alias.replace(SPECIAL_MARKDOWN_LINK_SYMBOLS_REGEX, '\\$&');

      return `${embedPrefix}[${alias}](${linkText})`;
    } else {
      if (alias && alias.toLowerCase() === linkText.toLowerCase()) {
        linkText = alias;
        alias = '';
      }

      const aliasPart = alias ? `|${alias}` : '';
      return `${embedPrefix}[[${linkText}${aliasPart}]]`;
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
