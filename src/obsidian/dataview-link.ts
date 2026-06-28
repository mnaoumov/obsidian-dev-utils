/**
 * @file
 *
 * This module provides utility functions for working with Dataview links in Obsidian
 */

import type {
  DataviewInlineApi,
  Link
} from './dataview.ts';
import type { PathOrFile } from './file-system.ts';

import {
  basename,
  dirname,
  extname
} from '../path.ts';
import { getPath } from './file-system.ts';

/**
 * Parameters for {@link fixTitle}.
 */
export interface FixTitleParams {
  /**
   * The DataviewInlineApi instance used to create the file link.
   */
  readonly dv: DataviewInlineApi;

  /**
   * A boolean indicating whether the file is a folder note.
   * If `true`, the title is derived from the folder name.
   *
   * @default `false`
   */
  readonly isFolderNote?: boolean;

  /**
   * The file path for which the title is to be fixed.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * Fixes the title of a file or folder note by generating a {@link Link} object with a proper title.
 *
 * @param params - The parameters for fixing the title.
 * @returns A Link object with the corrected title.
 */
export function fixTitle(params: FixTitleParams): Link {
  const {
    dv,
    isFolderNote,
    pathOrFile
  } = params;
  const path = getPath(dv.app, pathOrFile);
  const ext = extname(path);
  const title = isFolderNote ? basename(dirname(path)) : basename(path, ext);
  return dv.fileLink(path, false, title);
}

/**
 * Generates a string representation of a {@link Link} object that includes both the link text and the file path.
 *
 * @param link - The Link object to be converted to a string with its path.
 * @returns A string representing the link in the format: "linkText (linkPath)".
 */
export function makeLinkWithPath(link: Link): string {
  return `${String(link)} (${link.path})`;
}
