/**
 * @packageDocumentation
 *
 * Provides utility functions for working with backlinks.
 */

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */

import type { TFile } from 'obsidian';

import type {
  DataviewInlineApi,
  Link
} from './dataview.ts';
import type {
  PathOrAbstractFile,
  PathOrFile
} from './file-system.ts';

import { ensureNonNullable } from '../type-guards.ts';
import { renderCallout } from './callout.ts';
import { fixTitle } from './dataview-link.ts';
import { renderPaginatedTable } from './dataview.ts';
import {
  getAbstractFileOrNull,
  getMarkdownFiles,
  isFile,
  isFolder
} from './file-system.ts';
import { generateMarkdownLink } from './link.ts';
import { getBacklinksForFileSafe } from './metadata-cache.ts';

/**
 * Options for {@link renderDelayedBacklinksForFolder}.
 */
export interface RenderDelayedBacklinksForFolderParams {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  readonly dv: DataviewInlineApi;

  /**
   * A folder path. If not provided, the current file's folder will be used.
   */
  readonly folder?: string;

  /**
   * A title for the rendered backlinks. Defaults to "Folder Backlinks".
   */
  readonly title?: string;
}

/**
 * Options for {@link renderDelayedBacklinks}.
 */
export interface RenderDelayedBacklinksParams {
  /**
   * A {@link DataviewInlineApi} instance.
   */
  readonly dv: DataviewInlineApi;

  /**
   * An array of PathOrFile.
   */
  readonly files: PathOrFile[];

  /**
   * A title for the rendered backlinks. Defaults to "Backlinks".
   */
  readonly title?: string;
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

    if (!isFolder(abstractFile)) {
      throw new Error('Expected a folder');
    }

    return getMarkdownFiles(dv.app, abstractFile, true);
  });

  const backlinkRows: [Link, string[]][] = [];

  for (const file of files) {
    const link = fixTitle(dv, file.path);
    const backlinks = await getBacklinksForFileSafe(dv.app, file);
    const backlinkLinks = backlinks.keys().map((backLinkPath) => {
      const markdownLink = generateMarkdownLink({
        app: dv.app,
        sourcePathOrFile: dv.current().file.path,
        targetPathOrFile: ensureNonNullable(dv.app.metadataCache.getFirstLinkpathDest(backLinkPath, file.path), 'Link not found')
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
 * @param params - The parameters for rendering delayed backlinks.
 */
export function renderDelayedBacklinks(params: RenderDelayedBacklinksParams): void {
  const {
    dv,
    files,
    title = 'Backlinks'
  } = params;
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
 * @param params - The parameters for rendering delayed backlinks.
 */
export function renderDelayedBacklinksForFolder(params: RenderDelayedBacklinksForFolderParams): void {
  const {
    dv,
    folder,
    title = 'Folder Backlinks'
  } = params;
  const folder2 = folder ?? dv.current().file.folder;
  renderDelayedBacklinks({
    dv,
    files: getMarkdownFiles(dv.app, folder2, true),
    title
  });
}

/* v8 ignore stop */
