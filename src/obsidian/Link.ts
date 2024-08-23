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
  file,
  oldPath,
  renameMap,
  forceMarkdownLinks,
  embedOnlyLinks
}: {
  app: App,
  file: TFile,
  oldPath: string,
  renameMap: Map<string, string>,
  forceMarkdownLinks?: boolean | undefined
  embedOnlyLinks?: boolean | undefined
}): Promise<void> {
  await applyFileChanges(app, file, async () => {
    const cache = await getCacheSafe(app, file);
    if (!cache) {
      return [];
    }

    let links: ReferenceCache[] = [];

    switch (embedOnlyLinks) {
      case true:
        links = cache.embeds ?? [];
        break;
      case false:
        links = cache.links ?? [];
        break;
      case undefined:
        links = getAllLinks(cache);
        break;
    }

    return links.map((link) => ({
      startIndex: link.position.start.offset,
      endIndex: link.position.end.offset,
      oldContent: link.original,
      newContent: convertLink(app, link, file, oldPath, renameMap, forceMarkdownLinks),
    }));
  });
}

/**
 * Converts a link to a new path.
 *
 * @param app - The Obsidian application instance.
 * @param link - The reference cache for the link.
 * @param source - The source file.
 * @param oldPath - The old path of the link.
 * @param renameMap - A map of old paths to new paths for renaming.
 * @param forceMarkdownLinks - Optional flag to force markdown links.
 * @returns The converted link.
 */
function convertLink(app: App, link: ReferenceCache, source: TFile, oldPath: string, renameMap: Map<string, string>, forceMarkdownLinks?: boolean): string {
  oldPath ??= source.path;
  return updateLink({
    app,
    link,
    file: extractLinkFile(app, link, oldPath),
    oldPath,
    source,
    renameMap,
    forceMarkdownLinks
  });
}

/**
 * Extracts the file associated with a link.
 *
 * @param app - The Obsidian application instance.
 * @param link - The reference cache for the link.
 * @param oldPath - The old path of the file.
 * @returns The file associated with the link, or null if not found.
 */
export function extractLinkFile(app: App, link: ReferenceCache, oldPath: string): TFile | null {
  const { linkPath } = splitSubpath(link.link);
  return app.metadataCache.getFirstLinkpathDest(linkPath, oldPath);
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
  file,
  oldPath,
  source,
  renameMap,
  forceMarkdownLinks
}: {
  app: App,
  link: ReferenceCache,
  file: TFile | null,
  oldPath: string,
  source: TFile,
  renameMap: Map<string, string>,
  forceMarkdownLinks?: boolean | undefined
}): string {
  if (!file) {
    return link.original;
  }
  const isEmbed = link.original.startsWith("!");
  const isWikilink =
    link.original.includes("[[") && forceMarkdownLinks !== true;
  const { subpath } = splitSubpath(link.link);

  const newPath = renameMap.get(file.path);
  const alias = getAlias({
    app,
    displayText: link.displayText,
    file: file,
    otherPaths: [oldPath, newPath],
    sourcePath: source.path
  });

  if (newPath) {
    file = createTFileInstance(app.vault, newPath);
  }

  const newLink = generateMarkdownLink({
    app,
    file,
    sourcePath: source.path,
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
  file,
  otherPaths,
  sourcePath
}: {
  app: App,
  displayText: string | undefined,
  file: TFile,
  otherPaths: (string | undefined)[]
  sourcePath: string
}): string | undefined {
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
  file,
  sourcePath,
  subpath,
  alias,
  isEmbed,
  isWikilink,
  isRelative
}:
{
  app: App,
  file: TFile,
  sourcePath: string,
  subpath?: string | undefined,
  alias?: string | undefined,
  isEmbed?: boolean | undefined,
  isWikilink?: boolean | undefined,
  isRelative?: boolean | undefined
}): string {
  const useMarkdownLinks = app.vault.getConfig("useMarkdownLinks");
  const newLinkFormat = app.vault.getConfig("newLinkFormat");
  if (isWikilink !== undefined) {
    app.vault.setConfig("useMarkdownLinks", !isWikilink);
  }

  if (isRelative === true) {
    app.vault.setConfig("newLinkFormat", "relative");
  }

  let link = app.fileManager.generateMarkdownLink(file, sourcePath, subpath, alias);

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
