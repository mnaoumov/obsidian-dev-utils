/**
 * @module Link
 * This module provides utilities for handling and updating links within Obsidian vaults. It includes
 * functions to split paths, update links in files, and generate markdown links with various options.
 * The functions integrate with Obsidian's API to ensure that links are managed correctly within the vault.
 **/

import {
  normalizePath,
  type App,
  type ReferenceCache,
  type TFile
} from "obsidian";
import {
  getAllLinks,
  getCacheSafe
} from "./MetadataCache.ts";
import { applyFileChanges } from "./Vault.ts";
import { createTFileInstance } from "obsidian-typings/implementations";
import {
  basename,
  extname
} from "../Path.ts";
import { normalize } from "../String.ts";
import {
  getFile,
  type PathOrFile
} from "./TFile.ts";
import { getPath } from "./TAbstractFile.ts";
import {
  asyncMap,
  type MaybePromise,
  type RetryOptions
} from "../Async.ts";

type SplitSubpathResult = {
  linkPath: string;
  subpath: string | undefined;
};

/**
 * Splits a link into its link path and subpath.
 *
 * @param link - The link to split.
 * @returns An object containing the link path and subpath.
 */
export function splitSubpath(link: string): SplitSubpathResult {
  const SUBPATH_SEPARATOR = "#";
  const [linkPath = "", subpath] = normalize(link).split(SUBPATH_SEPARATOR);
  return {
    linkPath,
    subpath: subpath ? SUBPATH_SEPARATOR + subpath : undefined
  };
}

/**
 * Updates the links in a file based on the provided parameters.
 *
 * @param {Object} options - The options for updating the links.
 * @param {App} options.app - The Obsidian app instance.
 * @param {TFile} options.file - The file to update the links in.
 * @param {string} options.oldPath - The old path of the file.
 * @param {Map<string, string>} options.renameMap - A map of old and new paths for renaming links.
 * @param {boolean} [options.forceMarkdownLinks] - Whether to force the links to be in Markdown format.
 * @param {boolean} [options.embedOnlyLinks] - Whether to update only embedded links.
 * @returns {Promise<void>} - A promise that resolves when the links are updated.
 */
export async function updateLinksInFile({
  app,
  pathOrFile,
  oldPathOrFile,
  renameMap,
  forceMarkdownLinks,
  embedOnlyLinks
}: {
  app: App,
  pathOrFile: PathOrFile,
  oldPathOrFile: PathOrFile,
  renameMap: Map<string, string>,
  forceMarkdownLinks?: boolean | undefined
  embedOnlyLinks?: boolean | undefined
}): Promise<void> {
  await editLinks(app, pathOrFile, (link) => {
    const isEmbedLink = link.original.startsWith("!");
    if (embedOnlyLinks !== undefined && embedOnlyLinks !== isEmbedLink) {
      return link.original;
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
  oldPathOrFile ??= getPath(source);
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
 * Updates a link based on the provided parameters.
 *
 * @param {Object} options - The options for updating the link.
 * @param {App} options.app - The Obsidian app instance.
 * @param {ReferenceCache} options.link - The reference cache for the link.
 * @param {TFile | null} options.file - The file associated with the link.
 * @param {string} options.oldPath - The old path of the file.
 * @param {TFile} options.source - The source file containing the link.
 * @param {Map<string, string>} options.renameMap - The map of old and new file paths.
 * @param {boolean | undefined} [options.forceMarkdownLinks] - Whether to force markdown links.
 * @returns {string} The updated link.
 */
export function updateLink({
  app,
  link,
  pathOrFile,
  oldPathOrFile,
  sourcePathOrFile: source,
  renameMap,
  forceMarkdownLinks
}: {
  app: App,
  link: ReferenceCache,
  pathOrFile: PathOrFile | null,
  oldPathOrFile: PathOrFile,
  sourcePathOrFile: PathOrFile,
  renameMap: Map<string, string>,
  forceMarkdownLinks?: boolean | undefined
}): string {
  if (!pathOrFile) {
    return link.original;
  }
  const file = getFile(app, pathOrFile);
  const sourcePath = getPath(source);
  const oldPath = getPath(oldPathOrFile);
  const isEmbed = link.original.startsWith("!");
  const isWikilink =
    link.original.includes("[[") && forceMarkdownLinks !== true;
  const { subpath } = splitSubpath(link.link);

  const newPath = renameMap.get(file.path);
  const alias = getAlias({
    app,
    displayText: link.displayText,
    file: pathOrFile,
    otherPaths: [oldPath, newPath],
    sourcePath
  });

  if (newPath) {
    pathOrFile = createTFileInstance(app.vault, newPath);
  }

  const newLink = generateMarkdownLink({
    app,
    pathOrFile: file,
    sourcePathOrFile: sourcePath,
    subpath,
    alias,
    isEmbed,
    isWikilink
  });
  return newLink;
}

function getAlias({
  app,
  displayText,
  file: pathOrFile,
  otherPaths,
  sourcePath
}: {
  app: App,
  displayText: string | undefined,
  file: PathOrFile,
  otherPaths: (string | undefined)[]
  sourcePath: string
}): string | undefined {

  const file = getFile(app, pathOrFile);

  if (!displayText) {
    return undefined;
  }

  const cleanDisplayText = normalizePath(displayText.split(" > ")[0]!).replace(/\.\//g, "");

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
 * Generates a markdown link based on the provided parameters.
 *
 * @param {Object} options - The options for generating the markdown link.
 * @param {App} options.app - The Obsidian app instance.
 * @param {TFile} options.file - The file to link to.
 * @param {string} options.sourcePath - The source path of the link.
 * @param {string} [options.subpath] - The subpath of the link.
 * @param {string} [options.alias] - The alias for the link.
 * @param {boolean} [options.isEmbed] - Indicates if the link should be embedded.
 * @param {boolean} [options.isWikilink] - Indicates if the link should be a wikilink.
 * @param {boolean} [options.isRelative] - Indicates if the link should be relative.
 * @returns {string} The generated markdown link.
 */
export function generateMarkdownLink({
  app,
  pathOrFile,
  sourcePathOrFile,
  subpath,
  alias,
  isEmbed,
  isWikilink,
  isRelative
}: {
  app: App,
  pathOrFile: PathOrFile,
  sourcePathOrFile: PathOrFile,
  subpath?: string | undefined,
  alias?: string | undefined,
  isEmbed?: boolean | undefined,
  isWikilink?: boolean | undefined,
  isRelative?: boolean | undefined
}): string {
  const file = getFile(app, pathOrFile);
  const useMarkdownLinks = app.vault.getConfig("useMarkdownLinks");
  const newLinkFormat = app.vault.getConfig("newLinkFormat");
  if (isWikilink !== undefined) {
    app.vault.setConfig("useMarkdownLinks", !isWikilink);
  }

  if (isRelative === true) {
    app.vault.setConfig("newLinkFormat", "relative");
  }

  let link = app.fileManager.generateMarkdownLink(file, getPath(sourcePathOrFile), subpath, alias);

  app.vault.setConfig("useMarkdownLinks", useMarkdownLinks);
  app.vault.setConfig("newLinkFormat", newLinkFormat);

  const isLinkEmbed = link.startsWith("!");

  if (isEmbed !== undefined && isEmbed !== isLinkEmbed) {
    if (isEmbed) {
      link = "!" + link;
    } else {
      link = link.slice(1);
      link = link.replace("[]", `[${alias || file.basename}]`);
    }
  }

  return link;
}

/**
 * Edits the links in the specified file or path using the provided link converter function.
 *
 * @param app - The Obsidian application instance.
 * @param pathOrFile - The path or file to edit the links in.
 * @param linkConverter - The function that converts each link.
 * @returns A promise that resolves when the links have been edited.
 */
export async function editLinks(
  app: App,
  pathOrFile: PathOrFile,
  linkConverter: (link: ReferenceCache) => MaybePromise<string>,
  retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  return await applyFileChanges(app, pathOrFile, async () => {
    const cache = await getCacheSafe(app, pathOrFile);
    if (!cache) {
      return [];
    }

    return await asyncMap(getAllLinks(cache), async (link) => ({
      startIndex: link.position.start.offset,
      endIndex: link.position.end.offset,
      oldContent: link.original,
      newContent: await linkConverter(link),
    }));
  }, retryOptions);
}
