/**
 * @packageDocumentation
 *
 * Provides utility functions for working with backlinks.
 */

import type {
  TFile,
  TFolder
} from 'obsidian';

import type {
  DataviewInlineApi,
  Link
} from './Dataview.ts';
import type {
  PathOrAbstractFile,
  PathOrFile
} from './FileSystem.ts';

import { throwExpression } from '../Error.ts';
import { renderCallout } from './Callout.ts';
import { renderPaginatedTable } from './Dataview.ts';
import { fixTitle } from './DataviewLink.ts';
import {
  getAbstractFileOrNull,
  getMarkdownFiles,
  isFile
} from './FileSystem.ts';
import { generateMarkdownLink } from './Link.ts';
import { getBacklinksForFileSafe } from './MetadataCache.ts';

/**
 * Options for rendering delayed backlinks for a folder.
 */
export interface RenderDelayedBacklinksForFolderOptions {
  /**
   * The DataviewInlineApi instance.
   */
  dv: DataviewInlineApi;

  /**
   * The folder path. If not provided, the current file's folder will be used.
   */
  folder?: string;

  /**
   * The title for the rendered backlinks. Defaults to "Folder Backlinks".
   */
  title?: string;
}

/**
 * Options for rendering delayed backlinks.
 */
export interface RenderDelayedBacklinksOptions {
  /**
   * The DataviewInlineApi instance.
   */
  dv: DataviewInlineApi;

  /**
   * An array of PathOrFile.
   */
  files: PathOrFile[];

  /**
   * The title for the rendered backlinks. Defaults to "Backlinks".
   */
  title?: string;
}

/**
 * Renders a backlinks table using the provided DataviewInlineApi and optional array of PathOrAbstractFile.
 *
 * @param dv - The DataviewInlineApi instance.
 * @param pathOrFiles - An optional array of PathOrAbstractFile.
 * @returns A {@link Promise} that resolves when the backlinks table has been rendered.
 */
export async function renderBacklinksTable(dv: DataviewInlineApi, pathOrFiles?: PathOrAbstractFile[]): Promise<void> {
  pathOrFiles ??= [];
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
        sourcePathOrFile: dv.current().file.path,
        targetPathOrFile: dv.app.metadataCache.getFirstLinkpathDest(backLinkPath, file.path) ?? throwExpression(new Error('Link not found'))
      });

      return `${markdownLink} (${backLinkPath})`;
    });
    if (backlinkLinks.length) {
      backlinkRows.push([link, backlinkLinks]);
    }
  }

  await renderPaginatedTable({
    dv,
    headers: ['Note', 'Backlinks'],
    rows: backlinkRows
  });
}

/**
 * Renders delayed backlinks.
 *
 * @param options - The options for rendering delayed backlinks.
 */
export function renderDelayedBacklinks(options: RenderDelayedBacklinksOptions): void {
  const {
    dv,
    files,
    title = 'Backlinks'
  } = options;
  renderCallout({
    async contentProvider() {
      await renderBacklinksTable(dv, files);
    },
    dv,
    header: title
  });
}

/**
 * Renders delayed backlinks for a specific folder.
 *
 * @param options - The options for rendering delayed backlinks.
 */
export function renderDelayedBacklinksForFolder(options: RenderDelayedBacklinksForFolderOptions): void {
  const {
    dv,
    folder,
    title = 'Folder Backlinks'
  } = options;
  const folder2 = folder ?? dv.current().file.folder;
  renderDelayedBacklinks({
    dv,
    files: getMarkdownFiles(dv.app, folder2, true),
    title
  });
}
