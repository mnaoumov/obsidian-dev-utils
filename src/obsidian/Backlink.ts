/**
 * @module Backlink
 * Provides utility functions for working with backlinks.
 */

import {
  type Link,
  type DataviewInlineApi,
  renderPaginatedTable,
} from "./Dataview.ts";

import { renderCallout } from "./Callout.ts";
import { fixTitle } from "./DataviewLink.ts";
import {
  TFolder,
  type TFile
} from "obsidian";
import { generateMarkdownLink } from "./Link.ts";
import {
  getAbstractFileOrNull,
  isFile,
  type PathOrAbstractFile
} from "./TAbstractFile.ts";
import { getBacklinksForFileSafe } from "./MetadataCache.ts";
import { getMarkdownFiles } from "./TFolder.ts";
import type { PathOrFile } from "./TFile.ts";

/**
 * Renders delayed backlinks.
 *
 * @param {Object} options - The options for rendering delayed backlinks.
 * @param {DataviewInlineApi} options.dv - The Dataview inline API.
 * @param {PathOrFile[]} options.files - The array of files.
 * @param {string} [options.title="Backlinks"] - The title for the backlinks.
 * @returns {void}
 */
export function renderDelayedBacklinks({
  dv,
  files,
  title = "Backlinks"
}: {
  dv: DataviewInlineApi,
  files: PathOrFile[],
  title?: string
}): void {
  renderCallout({
    dv,
    header: title,
    async contentProvider() {
      await renderBacklinksTable(dv, files);
    }
  });
}

/**
 * Renders delayed backlinks for a specific folder.
 *
 * @param options - The options for rendering delayed backlinks.
 * @param options.dv - The DataviewInlineApi instance.
 * @param options.folder - The folder path. If not provided, the current file's folder will be used.
 * @param options.title - The title for the rendered backlinks. Defaults to "Folder Backlinks".
 */
export function renderDelayedBacklinksForFolder({
  dv,
  folder,
  title = "Folder Backlinks"
}: {
  dv: DataviewInlineApi,
  folder?: string,
  title?: string
}): void {
  folder ??= dv.current().file.folder;
  renderDelayedBacklinks({
    dv,
    files: getMarkdownFiles(dv.app, folder, true),
    title
  });
}

/**
 * Renders a backlinks table using the provided DataviewInlineApi and optional array of PathOrAbstractFile.
 *
 * @param dv - The DataviewInlineApi instance.
 * @param pathOrFiles - An optional array of PathOrAbstractFile.
 * @returns A Promise that resolves when the backlinks table has been rendered.
 */
export async function renderBacklinksTable(dv: DataviewInlineApi, pathOrFiles?: PathOrAbstractFile[]): Promise<void> {
  if (!pathOrFiles) {
    pathOrFiles = [];
  }
  const files: TFile[] = pathOrFiles.flatMap((abstractFileOrPath) => {
    const abstractFile = getAbstractFileOrNull(dv.app, abstractFileOrPath);
    if (!abstractFile) {
      return [];
    }

    if (isFile(abstractFile)) {
      return [abstractFile];
    }

    return getMarkdownFiles(dv.app, abstractFile as TFolder, true);
  });

  const backlinkRows: [Link, string[]][] = [];

  for (const file of files) {
    const link = fixTitle(dv, file.path);
    const backlinks = await getBacklinksForFileSafe(dv.app, file);
    const backlinkLinks = backlinks.keys().map((backLinkPath) => {
      const markdownLink = generateMarkdownLink({
        app: dv.app,
        pathOrFile: dv.app.metadataCache.getFirstLinkpathDest(backLinkPath, file.path)!,
        sourcePathOrFile: dv.current().file.path,
      });

      return `${markdownLink} (${backLinkPath})`;
    });
    if (backlinkLinks.length) {
      backlinkRows.push([link, backlinkLinks]);
    }
  }

  await renderPaginatedTable({
    dv,
    headers: ["Note", "Backlinks"],
    rows: backlinkRows,
  });
}
